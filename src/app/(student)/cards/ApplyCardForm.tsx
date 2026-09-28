"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Send } from "lucide-react";
import { applyForCard } from "@/app/actions/cards";
import type { ActionResult } from "@/app/actions/student";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { formatMoney, cn } from "@/lib/utils";

export type BankOption = {
  id: string;
  name: string;
  color: string;
  defaultLimit: number;
  monthlyRatePct: number;
  closingDay: number;
  dueDays: number;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <Send className="h-4 w-4" />
      {pending ? "Enviando..." : "Enviar solicitud"}
    </Button>
  );
}

/**
 * Solicitud de tarjeta. El alumno elige banco y cuánto límite pide; el banco
 * decide después si se lo da y con qué límite.
 */
export function ApplyCardForm({ banks }: { banks: BankOption[] }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    applyForCard,
    null,
  );
  const [bankId, setBankId] = useState(banks[0]?.id ?? "");
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  const bank = banks.find((b) => b.id === bankId) ?? banks[0];

  return (
    <Card>
      <CardTitle className="mb-1 text-base text-ink">
        Pedir una tarjeta de crédito
      </CardTitle>
      <p className="mb-4 text-sm text-ink/50">
        Elegí un banco y contales para qué la querés. Cada banco tiene sus
        propias condiciones.
      </p>

      <form ref={ref} action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="bankId" value={bankId} />

        <div>
          <Label>Banco</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {banks.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBankId(b.id)}
                aria-pressed={b.id === bankId}
                aria-label={`Pedir la tarjeta a ${b.name}`}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  b.id === bankId
                    ? "border-accent bg-accent/10"
                    : "border-raised2 bg-panel/80 hover:border-raised3",
                )}
              >
                <span
                  className="h-8 w-8 shrink-0 rounded-lg"
                  style={{ backgroundColor: b.color }}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {b.name}
                  </span>
                  <span className="block text-xs text-ink/45">
                    {b.monthlyRatePct}% mensual · cierra el {b.closingDay}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="requestedLimit">Límite que pedís</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40">
              $
            </span>
            <Input
              id="requestedLimit"
              name="requestedLimit"
              type="number"
              min="1"
              step="0.01"
              className="pl-8"
              defaultValue={bank?.defaultLimit || ""}
              placeholder="0,00"
              required
            />
          </div>
          {bank && bank.defaultLimit > 0 && (
            <p className="mt-1.5 px-1 text-xs text-ink/40">
              {bank.name} suele aprobar hasta {formatMoney(bank.defaultLimit)}.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="monthlyIncome">Tus ingresos por mes (opcional)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40">
              $
            </span>
            <Input
              id="monthlyIncome"
              name="monthlyIncome"
              type="number"
              min="0"
              step="0.01"
              className="pl-8"
              placeholder="0,00"
            />
          </div>
          <p className="mt-1.5 px-1 text-xs text-ink/40">
            Cuanto mejor expliques de dónde sale tu plata, más fácil te la
            aprueban.
          </p>
        </div>

        <div>
          <Label htmlFor="purpose">¿Para qué la necesitás?</Label>
          <Textarea
            id="purpose"
            name="purpose"
            rows={3}
            maxLength={200}
            placeholder="Ej: comprar mercadería para mi emprendimiento y pagarla a fin de mes."
          />
        </div>

        {state && (
          <FormFeedback
            ok={state.ok}
            msg={state.ok ? state.message : state.error}
          />
        )}
        <Submit />
      </form>
    </Card>
  );
}
