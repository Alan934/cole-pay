"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Coins } from "lucide-react";
import { fundBank } from "@/app/actions/banks";
import type { ActionResult } from "@/app/actions/student";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormFeedback } from "@/components/admin/FormFeedback";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <Coins className="h-4 w-4" />
      {pending ? "Cargando..." : "Capitalizar el banco"}
    </Button>
  );
}

/** Emisión del Banco Central hacia la caja de un banco. */
export function FundBankForm({ bankId }: { bankId: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    fundBank,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="bankId" value={bankId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="fund-amount">Monto</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40">
              $
            </span>
            <Input
              id="fund-amount"
              name="amount"
              type="number"
              min="1"
              step="0.01"
              className="pl-8"
              placeholder="0,00"
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="fund-desc">Concepto (opcional)</Label>
          <Input
            id="fund-desc"
            name="description"
            maxLength={120}
            placeholder="Capital inicial"
          />
        </div>
      </div>
      {state && (
        <FormFeedback
          ok={state.ok}
          msg={state.ok ? state.message : state.error}
        />
      )}
      <Submit />
    </form>
  );
}
