"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Send } from "lucide-react";
import { applyForLoan } from "@/app/actions/loans";
import type { ActionResult } from "@/app/actions/student";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { quoteLoan } from "@/lib/loans";
import { formatMoney, cn } from "@/lib/utils";

export type LoanBankOption = {
  id: string;
  name: string;
  color: string;
  loanRatePct: number;
  maxLoanAmount: number;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <Send className="h-4 w-4" />
      {pending ? "Enviando..." : "Pedir el préstamo"}
    </Button>
  );
}

/**
 * Pedido de préstamo. Mientras el alumno mueve el monto y las cuotas ve, en
 * vivo, cuánto va a terminar devolviendo: esa es la parte que enseña.
 */
export function LoanRequestForm({ banks }: { banks: LoanBankOption[] }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    applyForLoan,
    null,
  );
  const [bankId, setBankId] = useState(banks[0]?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [installments, setInstallments] = useState(3);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      setAmount(0);
      setInstallments(3);
    }
  }, [state]);

  const bank = banks.find((b) => b.id === bankId) ?? banks[0];
  const quote = quoteLoan(amount, bank?.loanRatePct ?? 0, installments);
  const overMax =
    bank && bank.maxLoanAmount > 0 && amount > bank.maxLoanAmount;

  return (
    <Card>
      <CardTitle className="mb-1 text-base text-ink">
        Pedir un préstamo
      </CardTitle>
      <p className="mb-4 text-sm text-ink/50">
        El banco te da la plata ahora y se la devolvés en cuotas, con interés.
        Mirá cuánto termina saliendo antes de pedirlo.
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
                aria-label={`Pedirle el préstamo a ${b.name}`}
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
                    {b.loanRatePct}% mensual
                    {b.maxLoanAmount > 0 &&
                      ` · hasta ${formatMoney(b.maxLoanAmount)}`}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="loan-amount">Cuánto necesitás</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40">
                $
              </span>
              <Input
                id="loan-amount"
                name="requestedAmount"
                type="number"
                min="1"
                step="0.01"
                className="pl-8"
                placeholder="0,00"
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.target.value))}
                required
              />
            </div>
            {overMax && (
              <p className="mt-1.5 px-1 text-xs text-danger">
                {bank.name} presta hasta {formatMoney(bank.maxLoanAmount)}.
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="loan-installments">En cuántas cuotas</Label>
            <Input
              id="loan-installments"
              name="requestedInstallments"
              type="number"
              min="1"
              max="24"
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
              required
            />
          </div>
        </div>

        {amount > 0 && (
          <div className="rounded-xl border border-violet/25 bg-violet/5 p-3">
            <p className="text-xs text-ink/50">{quote.formula}</p>
            <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <Mini label="Cuota" value={formatMoney(quote.installmentAmount)} />
              <Mini label="Intereses" value={formatMoney(quote.interest)} />
              <Mini label="Devolvés" value={formatMoney(quote.total)} />
            </dl>
            <p className="mt-2 text-xs text-ink/45">
              Recibís {formatMoney(quote.principal)} y devolvés{" "}
              {formatMoney(quote.total)}: {formatMoney(quote.interest)} de más
              por pagarlo en {quote.installments} cuotas.
            </p>
          </div>
        )}

        <div>
          <Label htmlFor="loan-income">Tus ingresos por mes (opcional)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40">
              $
            </span>
            <Input
              id="loan-income"
              name="monthlyIncome"
              type="number"
              min="0"
              step="0.01"
              className="pl-8"
              placeholder="0,00"
            />
          </div>
          <p className="mt-1.5 px-1 text-xs text-ink/40">
            El banco mira si te dan los números para pagar la cuota.
          </p>
        </div>

        <div>
          <Label htmlFor="loan-purpose">¿Para qué lo necesitás?</Label>
          <Textarea
            id="loan-purpose"
            name="purpose"
            rows={3}
            maxLength={200}
            placeholder="Ej: comprar la máquina para producir más y devolverlo con lo que venda."
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

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-raised/50 px-2.5 py-2">
      <dt className="text-[11px] text-ink/45">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );
}
