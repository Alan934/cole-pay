"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { saveBankTerm, toggleBankTerm } from "@/app/actions/deposits";
import type { ActionResult } from "@/app/actions/student";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export type BankTermView = {
  id: string;
  days: number;
  tnaPct: number;
  active: boolean;
  takenCount: number;
};

function Feedback({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p className={state.ok ? "text-sm text-accent" : "text-sm text-danger"}>
      {state.ok ? state.message : state.error}
    </p>
  );
}

function SubmitBtn({
  label,
  variant,
}: {
  label: string;
  variant?: "primary" | "outline";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? "..." : label}
    </Button>
  );
}

/**
 * La pizarra de tasas del banco: a qué TNA toma depósitos en cada plazo. Es la
 * otra mitad del negocio —la primera es a qué tasa presta— y la diferencia
 * entre las dos es lo que gana.
 */
export function RateBoard({
  terms,
  loanRatePct,
}: {
  terms: BankTermView[];
  loanRatePct: number;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    saveBankTerm,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  // El préstamo se pacta en tasa mensual; la comparación honesta es anualizarla.
  const loanAnnualPct = Math.round(loanRatePct * 12 * 100) / 100;
  const bestTaken = Math.max(0, ...terms.filter((t) => t.active).map((t) => t.tnaPct));

  return (
    <Card>
      <CardTitle className="mb-1">Pizarra de tasas</CardTitle>
      <p className="mb-4 text-sm text-ink/50">
        La TNA que le pagás a quien deje la plata en plazo fijo. Ojo con
        prometer más de lo que ganás prestando.
      </p>

      {bestTaken > 0 && (
        <div className="mb-4 rounded-xl border border-raised bg-raised/25 p-3 text-xs">
          <p className="text-ink/60">
            Pagás hasta{" "}
            <span className="font-semibold text-violet">{bestTaken}% TNA</span> por
            los depósitos y cobrás{" "}
            <span className="font-semibold text-accent">
              {loanAnnualPct}% anual
            </span>{" "}
            por los préstamos ({loanRatePct}% mensual).
          </p>
          <p
            className={`mt-1 font-medium ${
              loanAnnualPct > bestTaken ? "text-accent" : "text-danger"
            }`}
          >
            {loanAnnualPct > bestTaken
              ? `Ganás ${Math.round((loanAnnualPct - bestTaken) * 100) / 100} puntos de diferencia.`
              : "Estás pagando más de lo que cobrás: así el banco pierde plata."}
          </p>
        </div>
      )}

      {terms.length > 0 && (
        <div className="mb-4 divide-y divide-raised">
          {terms.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {t.days} días · {t.tnaPct}% TNA
                </p>
                <p className="text-xs text-ink/40">
                  {t.takenCount === 0
                    ? "Sin depósitos todavía"
                    : `${t.takenCount} ${t.takenCount === 1 ? "depósito activo" : "depósitos activos"}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {t.active ? (
                  <Badge tone="accent">Publicado</Badge>
                ) : (
                  <Badge tone="neutral">Fuera de pizarra</Badge>
                )}
                <ToggleTerm term={t} />
              </div>
            </div>
          ))}
        </div>
      )}

      <form ref={ref} action={formAction} className="flex flex-wrap items-end gap-2">
        <div className="w-28">
          <Label htmlFor="t-days">Días</Label>
          <Input
            id="t-days"
            name="days"
            type="number"
            min="1"
            max="365"
            placeholder="30"
            required
          />
        </div>
        <div className="w-32">
          <Label htmlFor="t-tna">TNA %</Label>
          <Input
            id="t-tna"
            name="tnaPct"
            type="number"
            min="0"
            step="0.01"
            placeholder="100"
            required
          />
        </div>
        <SubmitBtn label="Publicar plazo" />
      </form>
      <div className="mt-2">
        <Feedback state={state} />
      </div>
      <p className="mt-2 text-xs text-ink/40">
        Si cargás un plazo que ya existe, se actualiza la tasa. Los depósitos ya
        tomados mantienen la tasa que se pactó.
      </p>
    </Card>
  );
}

function ToggleTerm({ term }: { term: BankTermView }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    toggleBankTerm,
    null,
  );
  const { active } = term;
  return (
    <form action={formAction} title={state?.ok === false ? state.error : undefined}>
      <input type="hidden" name="termId" value={term.id} />
      <button
        type="submit"
        className="rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-raised hover:text-ink"
        aria-label={active ? "Sacar de la pizarra" : "Volver a publicar"}
      >
        {active ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </form>
  );
}
