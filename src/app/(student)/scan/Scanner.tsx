"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { CameraOff, ImageUp, ScanLine } from "lucide-react";
import { paymentPathFromQr } from "@/lib/redirect";
import { Button } from "@/components/ui/Button";

type Status =
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "error"; message: string };

/** Lado máximo (px) al que se achica cada cuadro antes de buscar el QR. */
const MAX_SIDE = 640;
/** Cada cuánto se analiza un cuadro: 8 veces por segundo alcanza y cuida batería. */
const SCAN_EVERY_MS = 120;

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "No tenemos permiso para usar la cámara. Habilitala en los ajustes del navegador y volvé a intentar.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No encontramos una cámara en este dispositivo.";
  }
  return "No pudimos abrir la cámara.";
}

export function Scanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const handledRef = useRef(false);
  const [status, setStatus] = useState<Status>({ kind: "starting" });
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  /** Resuelve un texto leído: si es un cobro de ColePay, va directo a pagar. */
  const handleText = useCallback(
    (text: string): boolean => {
      const path = paymentPathFromQr(text);
      if (!path) return false;
      handledRef.current = true;
      router.push(path);
      return true;
    },
    [router],
  );

  useEffect(() => {
    handledRef.current = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    let last = 0;
    let lastRejected = "";
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus({
          kind: "error",
          message:
            "Este navegador no permite usar la cámara (necesita una conexión segura).",
        });
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (err) {
        if (!cancelled) {
          setStatus({ kind: "error", message: cameraErrorMessage(err) });
        }
        return;
      }
      const video = videoRef.current;
      if (cancelled || !video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        /* el autoplay puede rechazar si la pestaña se ocultó */
      }
      if (cancelled) return;
      setStatus({ kind: "scanning" });

      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        if (handledRef.current || now - last < SCAN_EVERY_MS) return;
        last = now;

        const canvas = canvasRef.current;
        if (!canvas || video.readyState < video.HAVE_ENOUGH_DATA) return;
        const scale = Math.min(
          1,
          MAX_SIDE / Math.max(video.videoWidth, video.videoHeight),
        );
        const w = Math.max(1, Math.round(video.videoWidth * scale));
        const h = Math.max(1, Math.round(video.videoHeight * scale));
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, w, h);
        const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, {
          inversionAttempts: "dontInvert",
        });
        if (!code?.data) return;
        if (handleText(code.data)) return;
        // Un QR que no es de cobro: avisamos una sola vez y seguimos buscando.
        if (code.data !== lastRejected) {
          lastRejected = code.data;
          setNotice("Ese QR no es un cobro de ColePay.");
        }
      };
      raf = requestAnimationFrame(tick);
    }

    setStatus({ kind: "starting" });
    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [handleText, attempt]);

  /** Alternativa sin cámara: leer el QR desde una captura o foto guardada. */
  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(bitmap, 0, 0, w, h);
      const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h);
      if (!code?.data) {
        setNotice("No encontramos ningún QR en esa imagen.");
      } else if (!handleText(code.data)) {
        setNotice("Ese QR no es un cobro de ColePay.");
      }
    } catch {
      setNotice("No pudimos leer esa imagen.");
    }
  }

  const failed = status.kind === "error";

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          className={`h-full w-full object-cover ${failed ? "hidden" : ""}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white/80">
            <CameraOff className="h-10 w-10" />
            <p className="text-sm">{status.message}</p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAttempt((a) => a + 1)}
            >
              Reintentar
            </Button>
          </div>
        )}

        {!failed && (
          <>
            {/* Marco de enfoque */}
            <div className="pointer-events-none absolute inset-[14%] rounded-3xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.45)]" />
            {status.kind === "starting" && (
              <p className="absolute inset-x-0 bottom-4 text-center text-xs text-white/70">
                Abriendo la cámara…
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 text-center">
        <p className="flex items-center gap-2 text-sm text-ink/60">
          <ScanLine className="h-4 w-4 text-accent" />
          Apuntá al QR de cobro y te llevamos directo a pagar.
        </p>
        {notice && (
          <p role="status" className="text-sm text-danger">
            {notice}
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickImage}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => fileRef.current?.click()}
        >
          <ImageUp className="h-4 w-4" />
          Elegir una imagen con el QR
        </Button>
      </div>
    </div>
  );
}
