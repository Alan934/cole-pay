"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { SESSION_IDLE_MINUTES } from "@/lib/session-timeout";
import { Button } from "@/components/ui/Button";

/** Segundos de aviso previo al cierre automático. */
const WARN_SECONDS = 60;
const IDLE_MS = SESSION_IDLE_MINUTES * 60_000;

const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "wheel",
  "touchstart",
] as const;

/**
 * Cierra la sesión sola cuando la pestaña queda inactiva.
 *
 * Es el par visible del `session.maxAge` del JWT: el servidor ya rechaza el
 * token vencido, pero sin esto la pantalla se queda mostrando el saldo del
 * alumno anterior hasta que alguien navegue. En las PCs compartidas de la
 * institución eso es justo lo que queremos evitar.
 */
export function IdleLogout() {
  const router = useRouter();
  const lastActivity = useRef(Date.now());
  const closing = useRef(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  const keepAlive = useCallback(() => {
    lastActivity.current = Date.now();
    setRemaining(null);
    // Un request al servidor renueva la cookie del JWT en el middleware.
    router.refresh();
  }, [router]);

  useEffect(() => {
    const touch = () => {
      lastActivity.current = Date.now();
    };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, touch, { passive: true });
    }

    const timer = window.setInterval(() => {
      const left = IDLE_MS - (Date.now() - lastActivity.current);

      if (left <= 0) {
        if (closing.current) return;
        closing.current = true;
        window.clearInterval(timer);
        void logout();
        return;
      }

      setRemaining(left <= WARN_SECONDS * 1000 ? Math.ceil(left / 1000) : null);
    }, 1000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, touch);
      }
      window.clearInterval(timer);
    };
  }, []);

  if (remaining === null) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-raised3 bg-canvas p-6 text-center shadow-xl">
        <p className="text-base font-semibold text-ink">
          ¿Seguís ahí?
        </p>
        <p className="mt-2 text-sm text-ink/60">
          Por seguridad vamos a cerrar tu sesión en{" "}
          <span className="font-semibold text-ink">{remaining}s</span> por
          inactividad.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => logout()}>
            Salir ahora
          </Button>
          <Button className="flex-1" onClick={keepAlive}>
            Seguir acá
          </Button>
        </div>
      </div>
    </div>
  );
}
