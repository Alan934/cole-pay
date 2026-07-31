"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Landmark,
  TrendingUp,
  Lock,
  CheckCircle2,
  Unlock,
  AlertTriangle,
} from "lucide-react";
import {
  createDeposit,
  withdrawDeposit,
  breakDeposit,
} from "@/app/actions/features";
import type { ActionResult } from "@/app/actions/student";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatMoney, formatDate } from "@/lib/utils";
import { breakdown, DAYS_IN_YEAR } from "@/lib/interest";

export type DepositView = {
  id: string;
  principal: number;
  tnaPct: number;
  termDays: number;
  interest: number;
  maturesAt: string;
  matured: boolean;
  status: string;
  payout: number | null;
  estimatedPayout: number;
};

export type TermOption = { days: number; tnaPct: number };

function Feedback({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p className={state.ok ? "text-sm text-accent" : "text-sm text-red-300"}>
      {state.ok ? state.message : state.error}
    </p>
  );
}

function SubmitBtn({
  label,
  variant,
}: {
  label: string;
  variant?: "primary" | "outline" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? "..." : label}
    </Button>
  );
}

export function DepositsManager({
  deposits,
  balance,
  terms,
}: {
  deposits: DepositView[];
  balance: number;
  terms: TermOption[];
}) {
  const active = deposits.filter((d) => d.status === "ACTIVE");
  const done = deposits.filter((d) => d.status !== "ACTIVE");

  return (
    <div className="flex flex-col gap-5">
      <CreateDeposit balance={balance} terms={terms} />

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

function CreateDeposit({
  balance,
  terms,
}: {
  balance: number;
  terms: TermOption[];
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    createDeposit,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);
  const [principal, setPrincipal] = useState("");
  const [termDays, setTermDays] = useState(terms[0]?.days ?? 0);

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      setPrincipal("");
    }
  }, [state]);

  const term = terms.find((t) => t.days === termDays) ?? terms[0];
  // Vista previa en vivo: el alumno ve la cuenta antes de confirmar.
  const preview = useMemo(() => {
    const p = Number(principal);
    if (!term || !Number.isFinite(p) || p <= 0) return null;
    return breakdown(p, term.tnaPct, term.days);
  }, [principal, term]);

  if (terms.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 py-8 text-center text-ink/50">
        <Landmark className="h-7 w-7" />
        <p className="text-sm">
          El banco no está ofreciendo plazos fijos en este momento.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-accent" />
        <CardTitle className="text-ink/80">Nuevo plazo fijo</CardTitle>
      </div>
      <p className="mb-3 text-sm text-ink/50">
        Inmovilizás tu dinero por un plazo y al vencer cobrás más gracias al
        interés. Si lo rompés antes, perdés el interés.
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
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="d-term">Plazo</Label>
            <Select
              id="d-term"
              name="termDays"
              value={termDays}
              onChange={(e) => setTermDays(Number(e.target.value))}
            >
              {terms.map((o) => (
                <option key={o.days} value={o.days}>
                  {o.days} días · {o.tnaPct}% TNA
                </option>
              ))}
            </Select>
          </div>
        </div>

        {preview && (
          <div className="rounded-xl border border-raised bg-raised/30 p-3">
            <p className="mb-1.5 text-xs font-medium text-ink/60">
              Así se calcula lo que vas a cobrar:
            </p>
            <p className="font-mono text-xs leading-relaxed text-ink/70">
              capital × (TNA ÷ 100) × (días ÷ {DAYS_IN_YEAR})
              <br />
              {preview.formula}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-raised pt-2 text-sm">
              <span className="text-ink/60">
                Interés:{" "}
                <span className="font-semibold text-accent">
                  {formatMoney(preview.interest)}
                </span>
              </span>
              <span className="text-ink/60">
                Cobrás:{" "}
                <span className="font-semibold">
                  {formatMoney(preview.total)}
                </span>
              </span>
              <span className="text-ink/40">
                ({preview.periodRatePct}% en {preview.days} días)
              </span>
            </div>
          </div>
        )}

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
  const statusLabel =
    d.status === "WITHDRAWN"
      ? `Cobrado ${formatMoney(d.payout ?? 0)}`
      : d.status === "BROKEN"
        ? `Roto — recuperaste ${formatMoney(d.payout ?? 0)}`
        : `Vence ${formatDate(d.maturesAt)}`;

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
              {d.tnaPct}% TNA · {d.termDays} días · {statusLabel}
            </p>
          </div>
        </div>
        {d.status === "WITHDRAWN" ? (
          <Badge tone="neutral">Finalizado</Badge>
        ) : d.status === "BROKEN" ? (
          <Badge tone="neutral">Roto</Badge>
        ) : d.matured ? (
          <Badge tone="success">¡Listo para cobrar!</Badge>
        ) : (
          <Badge tone="warning">
            <Lock className="mr-1 h-3 w-3" /> En curso
          </Badge>
        )}
      </div>

      {d.status === "ACTIVE" && (
        <div className="mt-3 border-t border-raised pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink/60">
              Cobrás al vencer:{" "}
              <span className="font-semibold text-accent">
                {formatMoney(d.estimatedPayout)}
              </span>
            </span>
            {d.matured && <WithdrawButton depositId={d.id} />}
          </div>
          {!d.matured && <BreakDeposit d={d} />}
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

/** Romper el plazo pide confirmación: hay que ver lo que se pierde. */
function BreakDeposit({ d }: { d: DepositView }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    breakDeposit,
    null,
  );
  const [confirming, setConfirming] = useState(false);

  if (state) {
    return (
      <p
        className={`mt-2 text-xs ${state.ok ? "text-ink/50" : "text-red-300"}`}
      >
        {state.ok ? state.message : state.error}
      </p>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink/40 underline-offset-2 transition-colors hover:text-ink/70 hover:underline"
      >
        <Unlock className="h-3 w-3" />
        Necesito la plata ahora
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        <div className="text-xs leading-relaxed text-ink/70">
          Si rompés el plazo recuperás tus{" "}
          <span className="font-semibold">{formatMoney(d.principal)}</span>, pero{" "}
          <span className="font-semibold text-amber-300">
            perdés los {formatMoney(d.interest)} de interés
          </span>
          . Eso es lo que cuesta la liquidez.
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <form action={formAction}>
          <input type="hidden" name="depositId" value={d.id} />
          <SubmitBtn label="Romper igual" variant="danger" />
        </form>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs text-ink/50 hover:text-ink"
        >
          Mejor espero
        </button>
      </div>
    </div>
  );
}
