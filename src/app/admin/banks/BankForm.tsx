"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Landmark } from "lucide-react";
import { createBank, editBank } from "@/app/actions/banks";
import type { ActionResult } from "@/app/actions/student";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormFeedback } from "@/components/admin/FormFeedback";

export type BankFormData = {
  id: string;
  name: string;
  color: string;
  active: boolean;
  defaultLimit: number;
  monthlyRatePct: number;
  closingDay: number;
  dueDays: number;
  loanRatePct: number;
  maxLoanAmount: number;
};

const DEFAULTS = {
  color: "#4f46e5",
  defaultLimit: 5000,
  monthlyRatePct: 8,
  closingDay: 25,
  dueDays: 10,
  loanRatePct: 6,
  maxLoanAmount: 20000,
};

function Submit({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <Landmark className="h-4 w-4" />
      {pending
        ? "Guardando..."
        : editing
          ? "Guardar cambios"
          : "Crear el banco"}
    </Button>
  );
}

/**
 * Alta y edición de un banco. La política de crédito que se carga acá es la
 * que hereda cada tarjeta nueva que el banco emita.
 */
export function BankForm({ bank }: { bank?: BankFormData }) {
  const editing = Boolean(bank);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    editing ? editBank : createBank,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && !editing) ref.current?.reset();
  }, [state, editing]);

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-4">
      {bank && <input type="hidden" name="bankId" value={bank.id} />}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <Label htmlFor="bank-name">Nombre del banco</Label>
          <Input
            id="bank-name"
            name="name"
            maxLength={40}
            placeholder="Banco del Sol"
            defaultValue={bank?.name}
            required
          />
        </div>
        <div>
          <Label htmlFor="bank-color">Color</Label>
          <input
            id="bank-color"
            name="color"
            type="color"
            defaultValue={bank?.color ?? DEFAULTS.color}
            className="h-12 w-full cursor-pointer rounded-xl border border-raised2 bg-panel/80 px-2 sm:w-20"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="bank-limit">Límite sugerido por tarjeta</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40">
              $
            </span>
            <Input
              id="bank-limit"
              name="defaultLimit"
              type="number"
              min="0"
              step="0.01"
              className="pl-8"
              defaultValue={bank?.defaultLimit ?? DEFAULTS.defaultLimit}
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="bank-rate">Interés mensual por financiar (%)</Label>
          <Input
            id="bank-rate"
            name="monthlyRatePct"
            type="number"
            min="0"
            max="200"
            step="0.01"
            defaultValue={bank?.monthlyRatePct ?? DEFAULTS.monthlyRatePct}
            required
          />
        </div>
        <div>
          <Label htmlFor="bank-closing">Día de cierre del resumen</Label>
          <Input
            id="bank-closing"
            name="closingDay"
            type="number"
            min="1"
            max="28"
            defaultValue={bank?.closingDay ?? DEFAULTS.closingDay}
            required
          />
        </div>
        <div>
          <Label htmlFor="bank-due">Días hasta el vencimiento</Label>
          <Input
            id="bank-due"
            name="dueDays"
            type="number"
            min="1"
            max="30"
            defaultValue={bank?.dueDays ?? DEFAULTS.dueDays}
            required
          />
        </div>
      </div>

      <div className="grid gap-3 border-t border-raised2/60 pt-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p className="text-sm font-medium text-ink/70">Préstamos</p>
          <p className="text-xs text-ink/45">
            Condiciones con las que el banco presta plata en cuotas.
          </p>
        </div>
        <div>
          <Label htmlFor="bank-loan-rate">Interés mensual del préstamo (%)</Label>
          <Input
            id="bank-loan-rate"
            name="loanRatePct"
            type="number"
            min="0"
            max="200"
            step="0.01"
            defaultValue={bank?.loanRatePct ?? DEFAULTS.loanRatePct}
            required
          />
        </div>
        <div>
          <Label htmlFor="bank-max-loan">Tope por préstamo</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40">
              $
            </span>
            <Input
              id="bank-max-loan"
              name="maxLoanAmount"
              type="number"
              min="0"
              step="0.01"
              className="pl-8"
              defaultValue={bank?.maxLoanAmount ?? DEFAULTS.maxLoanAmount}
              required
            />
          </div>
          <p className="mt-1.5 px-1 text-xs text-ink/40">
            0 = sin tope.
          </p>
        </div>
      </div>

      {editing && (
        <label className="flex items-center gap-3 rounded-xl border border-raised2 bg-panel/60 px-4 py-3">
          <input
            type="checkbox"
            name="active"
            defaultChecked={bank?.active}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-sm">
            <span className="font-medium">Banco abierto</span>
            <span className="block text-xs text-ink/50">
              Si lo cerrás deja de recibir solicitudes nuevas, pero las tarjetas
              que ya emitió siguen funcionando.
            </span>
          </span>
        </label>
      )}

      {state && (
        <FormFeedback
          ok={state.ok}
          msg={state.ok ? state.message : state.error}
        />
      )}
      <Submit editing={editing} />
    </form>
  );
}
