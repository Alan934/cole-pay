"use client";

import { useState } from "react";
import { Eye, EyeOff, Nfc } from "lucide-react";
import { formatCardNumber, formatExpiry, maskCardNumber } from "@/lib/cards";
import { cn } from "@/lib/utils";

export type CardVisualData = {
  brandLabel: string;
  number: string;
  last4: string;
  holderName: string;
  expMonth: number;
  expYear: number;
  cvv: string;
  bankName: string;
  /** Color del banco, en hexadecimal. */
  color: string;
  status: "ACTIVE" | "BLOCKED" | "CANCELLED";
  expired?: boolean;
};

/**
 * El plástico. Arranca con los datos tapados y un botón para mostrarlos, como
 * hacen las apps de los bancos: la idea es que los alumnos se acostumbren a no
 * dejar el número a la vista de cualquiera.
 */
export function CreditCardVisual({
  card,
  className,
}: {
  card: CardVisualData;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const inactive = card.status !== "ACTIVE" || card.expired;

  return (
    <div
      className={cn(
        "relative aspect-[1.586/1] w-full max-w-sm overflow-hidden rounded-2xl p-5 text-white shadow-card",
        inactive && "grayscale",
        className,
      )}
      style={{
        background: `linear-gradient(135deg, ${card.color} 0%, ${card.color}bb 45%, #0b0b12 140%)`,
      }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold drop-shadow-sm">
            {card.bankName}
          </p>
          <p className="text-[11px] uppercase tracking-widest text-white/60">
            {card.brandLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? "Ocultar los datos" : "Mostrar los datos"}
          className="rounded-lg bg-white/15 p-1.5 text-white/90 transition-colors hover:bg-white/25"
        >
          {revealed ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="mt-5 flex items-center gap-3">
        {/* Chip y contactless, sólo decorativos. */}
        <div className="h-7 w-9 rounded-md bg-gradient-to-br from-amber-200 to-amber-400/80" />
        <Nfc className="h-5 w-5 text-white/70" />
      </div>

      <p className="mt-3 font-mono text-lg tracking-[0.12em] drop-shadow-sm sm:text-xl">
        {revealed ? formatCardNumber(card.number) : maskCardNumber(card.last4)}
      </p>

      <div className="mt-4 flex items-end justify-between gap-3 text-xs">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-white/50">
            Titular
          </p>
          <p className="truncate font-medium uppercase">{card.holderName}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/50">
            Vence
          </p>
          <p className="font-mono font-medium">
            {formatExpiry(card.expMonth, card.expYear)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/50">
            Cód.
          </p>
          <p className="font-mono font-medium">
            {revealed ? card.cvv : "•••"}
          </p>
        </div>
      </div>

      {inactive && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 rotate-[-12deg] rounded-lg border-2 border-white/70 px-3 py-1 text-sm font-bold uppercase tracking-widest text-white/80">
          {card.expired
            ? "Vencida"
            : card.status === "BLOCKED"
              ? "Bloqueada"
              : "De baja"}
        </span>
      )}
    </div>
  );
}
