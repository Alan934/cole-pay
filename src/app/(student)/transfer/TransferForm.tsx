"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check, Send } from "lucide-react";
import { transferMoney, type ActionResult } from "@/app/actions/student";
import { Card } from "@/components/ui/Card";
import { Input, Label, Textarea, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/utils";
import { SPENDING_CATEGORIES } from "@/lib/validations";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      <Send className="h-5 w-5" />
      {pending ? "Enviando..." : "Enviar dinero"}
    </Button>
  );
}

export function TransferForm({
  balance,
  prefill,
}: {
  balance: number;
  prefill?: { to?: string; amount?: string; desc?: string; req?: string };
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    transferMoney,
    null,
  );
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      setShowSuccess(true);
      const t = setTimeout(() => setShowSuccess(false), 3500);
      return () => clearTimeout(t);
    }
  }, [state]);

  if (showSuccess && state?.ok) {
    return (
      <Card className="flex flex-col items-center gap-4 py-12 text-center animate-fade-in">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-accent/15 animate-pop-in">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-accent text-onaccent">
            <Check className="h-8 w-8" strokeWidth={3} />
          </div>
        </div>
        <div>
          <p className="text-lg font-semibold">¡Transferencia exitosa!</p>
          <p className="mt-1 text-sm text-ink/50">{state.message}</p>
        </div>
        <Button variant="secondary" onClick={() => setShowSuccess(false)}>
          Hacer otra transferencia
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-4">
        {prefill?.req && <input type="hidden" name="req" value={prefill.req} />}
        <div>
          <Label htmlFor="destination">CVU o Alias del destinatario</Label>
          <Input
            id="destination"
            name="destination"
            placeholder="ej: sofia.sol.mar"
            autoComplete="off"
            defaultValue={prefill?.to ?? ""}
            required
          />
        </div>

        <div>
          <Label htmlFor="amount">Monto</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40">
              $
            </span>
            <Input
              id="amount"
              name="amount"
              type="number"
              min="1"
              step="0.01"
              placeholder="0,00"
              className="pl-8 text-lg"
              defaultValue={prefill?.amount ?? ""}
              required
            />
          </div>
          <p className="mt-1.5 px-1 text-xs text-ink/40">
            Disponible: {formatMoney(balance)}
          </p>
        </div>

        <div>
          <Label htmlFor="category">Categoría</Label>
          <Select id="category" name="category" defaultValue="General">
            {SPENDING_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="description">Mensaje (opcional)</Label>
          <Textarea
            id="description"
            name="description"
            rows={2}
            maxLength={120}
            placeholder="¿Para qué es esta transferencia?"
            defaultValue={prefill?.desc ?? ""}
          />
        </div>

        {state && !state.ok && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {state.error}
          </div>
        )}

        <SubmitButton />
      </form>
    </Card>
  );
}
