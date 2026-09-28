"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";
import { useFormStatus } from "react-dom";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { depositCash, withdrawCash } from "@/app/actions/cash";
import type { ActionResult } from "@/app/actions/student";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/utils";

export type CustomerOption = {
  id: string;
  name: string;
  group: string | null;
  balance: number;
};

function Feedback({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p className={state.ok ? "text-sm text-accent" : "text-sm text-danger"}>
      {state.ok ? state.message : state.error}
    </p>
  );
}

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="md" disabled={pending}>
      {pending ? "..." : label}
    </Button>
  );
}

export function CashDesk({
  customers,
  bankBalance,
}: {
  customers: CustomerOption[];
  bankBalance: number;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CashForm
        kind="deposit"
        customers={customers}
        bankBalance={bankBalance}
      />
      <CashForm
        kind="withdrawal"
        customers={customers}
        bankBalance={bankBalance}
      />
    </div>
  );
}

function CashForm({
  kind,
  customers,
  bankBalance,
}: {
  kind: "deposit" | "withdrawal";
  customers: CustomerOption[];
  bankBalance: number;
}) {
  const isDeposit = kind === "deposit";
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    isDeposit ? depositCash : withdrawCash,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  const Icon = isDeposit ? ArrowDownToLine : ArrowUpFromLine;

  // Junto al nombre va el curso y el saldo: es lo que el cajero necesita ver
  // para confirmar que está atendiendo a quien cree, y además se puede buscar
  // por curso.
  const options = useMemo(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: c.name,
        hint: [c.group, formatMoney(c.balance)].filter(Boolean).join(" · "),
      })),
    [customers],
  );

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <Icon className={`h-5 w-5 ${isDeposit ? "text-accent" : "text-violet"}`} />
        <CardTitle className="text-ink/80">
          {isDeposit ? "Depósito en efectivo" : "Extracción de efectivo"}
        </CardTitle>
      </div>
      <p className="mb-3 text-sm text-ink/50">
        {isDeposit
          ? "Contá los billetes que te trae el cliente, guardalos en la caja y acreditáselos en la cuenta."
          : "Descontale el saldo y entregale los billetes. Tenés que tener el efectivo en la caja."}
      </p>

      <form ref={ref} action={formAction} className="flex flex-col gap-3">
        <div>
          <Label htmlFor={`${kind}-customer`}>Cliente</Label>
          <SearchSelect
            id={`${kind}-customer`}
            name="customerId"
            options={options}
            required
            placeholder="Elegí al alumno…"
            searchPlaceholder="Buscar por nombre o curso…"
            emptyMessage="No se encontró ningún alumno."
          />
        </div>

        <div>
          <Label htmlFor={`${kind}-amount`}>Importe</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40">
              $
            </span>
            <Input
              id={`${kind}-amount`}
              name="amount"
              type="number"
              min="1"
              step="0.01"
              placeholder="0,00"
              className="pl-7"
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor={`${kind}-note`}>Detalle (opcional)</Label>
          <Input
            id={`${kind}-note`}
            name="note"
            placeholder={isDeposit ? "Venta del kiosco" : "Para comprar insumos"}
            maxLength={120}
          />
        </div>

        {!isDeposit && (
          <p className="text-xs text-ink/40">
            Efectivo en la caja: {formatMoney(bankBalance)}
          </p>
        )}

        <Feedback state={state} />
        <div>
          <SubmitBtn label={isDeposit ? "Acreditar depósito" : "Pagar extracción"} />
        </div>
      </form>
    </Card>
  );
}
