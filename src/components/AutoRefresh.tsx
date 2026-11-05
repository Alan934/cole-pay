"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Vuelve a pedirle al servidor los datos de la pantalla cada tanto, para que
 * un cambio hecho por otra persona (por ejemplo, que paguen un QR) aparezca
 * sin recargar a mano. No dibuja nada.
 *
 * Sólo corre con la pestaña a la vista y se apaga cuando `active` es falso
 * (si no queda nada por esperar, no hace consultas de más).
 */
export function AutoRefresh({
  active = true,
  everyMs = 3000,
}: {
  active?: boolean;
  everyMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, everyMs);
    // Al volver a la pestaña (o a la app) se actualiza enseguida.
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active, everyMs, router]);

  return null;
}
