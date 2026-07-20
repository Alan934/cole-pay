"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Landmark, TrendingUp, Lock, CheckCircle2 } from "lucide-react";
import { createDeposit, withdrawDeposit } from "@/app/actions/features";
import type { ActionResult } from "@/app/actions/student";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatMoney, formatDate } from "@/lib/utils";

export type DepositView = {
  id: string;
  principal: number;
  ratePct: number;
  maturesAt: string;
  matured: boolean;
  status: string;
  payout: number | null;
  estimatedPayout: number;
};

const RATE_OPTIONS = [
  { days: 7, rate: 2 },
  { days: 14, rate: 5 },
  { days: 30, rate: 12 },
];

function Feedback({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p className={state.ok ? "text-sm text-accent" : "text-sm text-red-300"}>
      {state.ok ? state.message : state.error}
    </p>
  );
}

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "..." : label}
    </Button>
  );
}

export function DepositsManager({
  deposits,
  balance,
}: {
  deposits: DepositView[];
  balance: number;
}) {
  const active = deposits.filter((d) => d.status === "ACTIVE");
  const done = deposits.filter((d) => d.status !== "ACTIVE");

  return (
    <div className="flex flex-col gap-5">
      <CreateDeposit balance={balance} />

      {active.length > 0 && (
        <section className="flex flex-col gap-3">
          <CardTitle className="px-1">Plazos activos</CardTitle>
          {active.map((d) => (
            <DepositCard key={d.id} d={d} />
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section className="flex flex-col gap-3">
          <CardTitle className="px-1">Finalizados</CardTitle>
          {done.map((d) => (
            <DepositCard key={d.id} d={d} />
          ))}
        </section>
      )}

      {deposits.length === 0 && (
        <Card className="flex flex-col items-center gap-2 py-10 text-center text-ink/40">
          <Landmark className="h-8 w-8" />
          <p className="text-sm">
            No tenés plazos fijos. ¡Invertí y ganá interés!
          </p>
        </Card>
      )}
    </div>
  );
}

function CreateDeposit({ balance }: { balance: number }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    createDeposit,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-accent" />
        <CardTitle className="text-ink/80">Nuevo plazo fijo</CardTitle>
      </div>
      <p className="mb-3 text-sm text-ink/50">
        Inmovilizás tu dinero por un plazo y al vencer cobrás más gracias al
        interés.
      </p>
      <form ref={ref} action={formAction} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="d-principal">Monto a invertir</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40">
                $
              </span>
              <Input
                id="d-principal"
                name="principal"
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
            <Label htmlFor="d-term">Plazo</Label>
            <Select id="d-term" name="termDays" defaultValue="7">
              {RATE_OPTIONS.map((o) => (
                <option key={o.days} value={o.days}>
                  {o.days} días · {o.rate}% de interés
                </option>
              ))}
            </Select>
          </div>
        </div>
        <p className="text-xs text-ink/40">Disponible: {formatMoney(balance)}</p>
        <Feedback state={state} />
        <div>
          <SubmitBtn label="Crear plazo fijo" />
        </div>
      </form>
    </Card>
  );
}

function DepositCard({ d }: { d: DepositView }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet/15 text-violet">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">{formatMoney(d.principal)}</p>
            <p className="text-xs text-ink/40">
              {d.ratePct}% ·{" "}
              {d.status === "WITHDRAWN"
                ? `Cobrado ${formatMoney(d.payout ?? 0)}`
                : `Vence ${formatDate(d.maturesAt)}`}
            </p>
          </div>
        </div>
        {d.status === "WITHDRAWN" ? (
          <Badge tone="neutral">Finalizado</Badge>
        ) : d.matured ? (
          <Badge tone="success">¡Listo para cobrar!</Badge>
        ) : (
          <Badge tone="warning">
            <Lock className="mr-1 h-3 w-3" /> En curso
          </Badge>
        )}
      </div>

      {d.status === "ACTIVE" && (
        <div className="mt-3 flex items-center justify-between border-t border-raised pt-3">
          <span className="text-sm text-ink/60">
            Cobrás al vencer:{" "}
            <span className="font-semibold text-accent">
              {formatMoney(d.estimatedPayout)}
            </span>
          </span>
          {d.matured && <WithdrawButton depositId={d.id} />}
        </div>
      )}
    </Card>
  );
}

function WithdrawButton({ depositId }: { depositId: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    withdrawDeposit,
    null,
  );
  if (state?.ok) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-accent">
        <CheckCircle2 className="h-4 w-4" /> Cobrado
      </span>
    );
  }
  return (
    <form action={formAction}>
      <input type="hidden" name="depositId" value={depositId} />
      <SubmitBtn label="Cobrar" />
    </form>
  );
}
