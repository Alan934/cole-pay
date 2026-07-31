"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Flecha para volver, en el header de todas las pantallas.
 *
 * Se esconde en la raíz de cada sección (ahí no hay a dónde volver) y, si no hay
 * historial propio —entraron por un link de cobro o escaneando un QR—, cae al
 * inicio en vez de sacar al alumno de la app.
 */
export function BackButton({ home }: { home: string }) {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === home) return null;

  return (
    <button
      type="button"
      aria-label="Volver"
      title="Volver"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(home);
      }}
      className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink/60 transition-colors hover:bg-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
