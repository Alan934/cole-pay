import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * El isotipo es azul marino (#102050): contra el tema oscuro queda con 1.2:1 de
 * contraste, o sea invisible. Por eso siempre va montado sobre un tile blanco,
 * que además lo hace leer como ícono de app en ambos temas. Los PNG ya vienen
 * aplanados contra blanco (ver scripts/optimize-logos.mjs), así que el tile
 * necesita `overflow-hidden` para que las esquinas cuadradas de la imagen no se
 * asomen fuera del redondeo.
 */
const TILE = "overflow-hidden bg-white shadow-glow ring-1 ring-black/5";

const SIZES = {
  sm: { box: "h-8 w-8 rounded-xl p-0.5", px: 32, text: "text-lg" },
  md: { box: "h-10 w-10 rounded-2xl p-1", px: 40, text: "text-xl" },
  lg: { box: "h-14 w-14 rounded-2xl p-1.5", px: 56, text: "text-3xl" },
} as const;

export function LogoMark({
  size = "md",
  className,
  alt = "",
}: {
  size?: keyof typeof SIZES;
  className?: string;
  alt?: string;
}) {
  const { box, px } = SIZES[size];
  return (
    <span className={cn("grid shrink-0 place-items-center", TILE, box, className)}>
      <Image
        src="/logo-mark.png"
        alt={alt}
        width={px}
        height={px}
        priority
        className="h-full w-full object-contain"
      />
    </span>
  );
}

export function Logo({
  className,
  size = "md",
}: {
  className?: string;
  size?: keyof typeof SIZES;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className={cn("font-bold tracking-tight", SIZES[size].text)}>
        Cole<span className="text-accent">Pay</span>
      </span>
    </div>
  );
}

/** Lockup completo (isotipo + nombre) para pantallas de marca, como el login. */
export function LogoWordmark({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-3xl p-5", TILE, className)}>
      <Image
        src="/logo-wordmark.png"
        alt="ColePay"
        width={160}
        height={149}
        priority
        className="h-auto w-36 sm:w-40"
      />
    </div>
  );
}
