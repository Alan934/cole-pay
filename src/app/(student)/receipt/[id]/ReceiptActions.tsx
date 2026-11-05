"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, Printer, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { buildReceiptImage, type ReceiptImageData } from "./receipt-image";

/**
 * Los dos botones del comprobante. "Compartir" manda una imagen del
 * comprobante por el menú del celular (WhatsApp, mail…); donde no se pueden
 * compartir archivos —la compu— la descarga para adjuntarla.
 * "Imprimir" abre el diálogo del navegador, que también permite guardar en PDF.
 */
export function ReceiptActions({
  image,
  fileName,
}: {
  image: ReceiptImageData;
  fileName: string;
}) {
  const [canShare, setCanShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  // La imagen se prepara de antemano: el menú de compartir sólo se abre si se
  // lo pide dentro del toque del botón, y dibujarla en ese momento lo demora.
  const ready = useRef<Promise<Blob> | null>(null);

  useEffect(() => {
    // Se decide después de montar: en el servidor no hay `navigator`.
    const probe = new File([""], "a.png", { type: "image/png" });
    setCanShare(
      typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }),
    );
    ready.current = buildReceiptImage(image);
    ready.current.catch(() => {});
  }, [image]);

  async function share() {
    setBusy(true);
    setFailed(false);
    try {
      const blob = await (ready.current ?? buildReceiptImage(image));
      const file = new File([blob], `${fileName}.png`, { type: "image/png" });
      if (canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: image.title });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        setDone(true);
        setTimeout(() => setDone(false), 2500);
      }
    } catch (e) {
      // Cerrar el menú de compartir tira AbortError: no es un error de verdad.
      if (!(e instanceof DOMException && e.name === "AbortError")) setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function print() {
    // El nombre del archivo que propone "Guardar como PDF" sale del título.
    const previous = document.title;
    document.title = fileName;
    window.print();
    document.title = previous;
  }

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <div className="grid grid-cols-2 gap-2">
        <Button
          size="lg"
          className="px-3 whitespace-nowrap"
          onClick={share}
          disabled={busy}
        >
          {done ? (
            <Check className="h-5 w-5" />
          ) : canShare ? (
            <Share2 className="h-5 w-5" />
          ) : (
            <Download className="h-5 w-5" />
          )}
          {done ? "¡Descargada!" : canShare ? "Compartir" : "Descargar imagen"}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="px-3 whitespace-nowrap"
          onClick={print}
        >
          <Printer className="h-5 w-5" />
          Imprimir / PDF
        </Button>
      </div>
      {failed && (
        <p role="alert" className="text-center text-xs text-red-400">
          No se pudo preparar la imagen. Probá de nuevo o usá Imprimir / PDF.
        </p>
      )}
    </div>
  );
}
