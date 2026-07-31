"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Settings2,
  Landmark,
  PlayCircle,
  History,
  Flame,
  Trophy,
  Power,
} from "lucide-react";
import {
  updateBankSettings,
  updateInflationSettings,
  saveDepositTerm,
  toggleDepositTerm,
  forceAccrual,
  forceInflation,
} from "@/app/actions/interest";
import type { ActionResult } from "@/app/actions/student";
import type { BankSettingsView } from "@/lib/settings";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { formatMoney, formatDate } from "@/lib/utils";
import { tnaToTea, simpleInterest } from "@/lib/interest";

type TermRow = { id: string; days: number; tnaPct: number; active: boolean };
type RunRow = {
  id: string;
  runAt: string;
  days: number;
  totalPaid: number;
  walletsCount: number;
  trigger: string;
};

function Submit({
  label,
  pendingLabel,
  variant = "primary",
  icon: Icon,
}: {
  label: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "outline";
  icon?: typeof Settings2;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {Icon && <Icon className="h-4 w-4" />}
      {pending ? (pendingLabel ?? "Guardando...") : label}
    </Button>
  );
}

function Result({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <FormFeedback ok={state.ok} msg={state.ok ? state.message : state.error} />
  );
}

export function YieldsManager({
  settings,
  terms,
  runs,
  topEarners,
}: {
  settings: BankSettingsView;
  terms: TermRow[];
  runs: RunRow[];
  topEarners: { name: string; total: number }[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <TasasForm settings={settings} />
      <TermsCard terms={terms} />
      <InflationForm settings={settings} />
      <AccrualCard runs={runs} />
      <EarnersCard earners={topEarners} />
    </div>
  );
}

/* ------------------------------- Tasas -------------------------------- */

function TasasForm({ settings }: { settings: BankSettingsView }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    updateBankSettings,
    null,
  );
  const [balanceTna, setBalanceTna] = useState(settings.balanceTnaPct);
  const [goalsTna, setGoalsTna] = useState(settings.goalsTnaPct);

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Settings2 className="h-5 w-5 text-accent" />
        <CardTitle className="text-ink/80">Tasas del banco</CardTitle>
      </div>
      <p className="mb-4 text-sm text-ink/50">
        A menos disponibilidad del dinero, más TNA. Ese escalón es la lección:
        el rendimiento se paga con liquidez.
      </p>

      <form action={action} className="flex flex-col gap-4">
        <label className="flex items-center gap-3 rounded-xl border border-raised2 bg-panel/60 px-4 py-3">
          <input
            type="checkbox"
            name="interestEnabled"
            defaultChecked={settings.interestEnabled}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-sm">
            <span className="font-medium">Rendimientos activados</span>
            <span className="block text-xs text-ink/50">
              Mientras esté apagado no se acredita nada, aunque el cron corra.
            </span>
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="balanceTna">TNA del saldo disponible (%)</Label>
            <Input
              id="balanceTna"
              name="balanceTnaPct"
              type="number"
              min="0"
              max="9999"
              step="0.01"
              value={balanceTna}
              onChange={(e) => setBalanceTna(Number(e.target.value))}
              required
            />
            <p className="mt-1 text-xs text-ink/40">
              TEA equivalente: {tnaToTea(balanceTna)}%
            </p>
          </div>
          <div>
            <Label htmlFor="goalsTna">TNA de las metas de ahorro (%)</Label>
            <Input
              id="goalsTna"
              name="goalsTnaPct"
              type="number"
              min="0"
              max="9999"
              step="0.01"
              value={goalsTna}
              onChange={(e) => setGoalsTna(Number(e.target.value))}
              required
            />
            <p className="mt-1 text-xs text-ink/40">
              TEA equivalente: {tnaToTea(goalsTna)}%
            </p>
          </div>
          <div>
            <Label htmlFor="lockDays">Permanencia mínima en metas (días)</Label>
            <Input
              id="lockDays"
              name="goalsLockDays"
              type="number"
              min="0"
              max="365"
              defaultValue={settings.goalsLockDays}
              required
            />
            <p className="mt-1 text-xs text-ink/40">
              0 = pueden retirar cuando quieran.
            </p>
          </div>
          <div>
            <Label htmlFor="minBalance">Saldo mínimo para generar</Label>
            <Input
              id="minBalance"
              name="minBalanceToEarn"
              type="number"
              min="0"
              step="0.01"
              defaultValue={settings.minBalanceToEarn}
              required
            />
            <p className="mt-1 text-xs text-ink/40">
              Debajo de este saldo no se acredita interés.
            </p>
          </div>
        </div>

        {balanceTna > 0 && goalsTna <= balanceTna && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
            Ojo: las metas rinden igual o menos que el saldo disponible. Así no
            hay ningún motivo para ahorrar y se pierde la lección.
          </p>
        )}

        <Result state={state} />
        <div>
          <Submit label="Guardar tasas" />
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------- Plazos ------------------------------- */

function TermsCard({ terms }: { terms: TermRow[] }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    saveDepositTerm,
    null,
  );

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Landmark className="h-5 w-5 text-violet" />
        <CardTitle className="text-ink/80">Plazos fijos ofrecidos</CardTitle>
      </div>
      <p className="mb-4 text-sm text-ink/50">
        Cada plazo tiene su TNA. Si cargás un plazo que ya existe, se actualiza
        la tasa.
      </p>

      <div className="mb-4 flex flex-col gap-2">
        {terms.length === 0 && (
          <p className="text-sm text-ink/40">
            No hay plazos cargados: los alumnos no pueden hacer plazo fijo.
          </p>
        )}
        {terms.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-raised bg-panel/50 px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">
                {t.days} días · {t.tnaPct}% TNA
              </p>
              <p className="text-xs text-ink/40">
                $10.000 rinden{" "}
                {formatMoney(simpleInterest(10000, t.tnaPct, t.days))} en el
                plazo
              </p>
            </div>
            <div className="flex items-center gap-2">
              {t.active ? (
                <Badge tone="success">Activo</Badge>
              ) : (
                <Badge tone="neutral">De baja</Badge>
              )}
              <ToggleTerm termId={t.id} active={t.active} />
            </div>
          </div>
        ))}
      </div>

      <form action={action} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="term-days">Días</Label>
            <Input
              id="term-days"
              name="days"
              type="number"
              min="1"
              max="365"
              placeholder="60"
              required
            />
          </div>
          <div>
            <Label htmlFor="term-tna">TNA (%)</Label>
            <Input
              id="term-tna"
              name="tnaPct"
              type="number"
              min="0"
              max="9999"
              step="0.01"
              placeholder="120"
              required
            />
          </div>
        </div>
        <Result state={state} />
        <div>
          <Submit label="Guardar plazo" variant="secondary" />
        </div>
      </form>
    </Card>
  );
}

function ToggleTerm({ termId, active }: { termId: string; active: boolean }) {
  const [, action] = useActionState<ActionResult | null, FormData>(
    toggleDepositTerm,
    null,
  );
  return (
    <form action={action}>
      <input type="hidden" name="termId" value={termId} />
      <button
        type="submit"
        title={active ? "Dar de baja" : "Reactivar"}
        className="grid h-8 w-8 place-items-center rounded-lg text-ink/40 transition-colors hover:bg-raised hover:text-ink"
      >
        <Power className="h-4 w-4" />
      </button>
    </form>
  );
}

/* ----------------------------- Liquidación ---------------------------- */

function AccrualCard({ runs }: { runs: RunRow[] }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    forceAccrual,
    null,
  );

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <PlayCircle className="h-5 w-5 text-accent" />
        <CardTitle className="text-ink/80">Liquidar ahora</CardTitle>
      </div>
      <p className="mb-4 text-sm text-ink/50">
        Los intereses se acreditan automáticamente una vez por día. Usá esto
        para recuperar un día que no corrió, o para simular el paso del tiempo
        en clase.
      </p>

      <form action={action} className="mb-5 flex flex-col gap-3">
        <div>
          <Label htmlFor="acc-days">Días a liquidar</Label>
          <div className="flex gap-2">
            <Input
              id="acc-days"
              name="days"
              type="number"
              min="1"
              max="366"
              defaultValue={1}
              className="flex-1"
              required
            />
            <Submit
              label="Liquidar"
              pendingLabel="Liquidando..."
              icon={PlayCircle}
            />
          </div>
          <p className="mt-1 text-xs text-ink/40">
            Ej.: poné 30 para mostrar de una cuánto rinde un mes.
          </p>
        </div>
        <Result state={state} />
      </form>

      <div className="flex items-center gap-2 border-t border-raised pt-4">
        <History className="h-4 w-4 text-ink/40" />
        <CardTitle>Últimas liquidaciones</CardTitle>
      </div>
      {runs.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink/40">
          Todavía no se liquidó ningún interés.
        </p>
      ) : (
        <div className="mt-2 divide-y divide-raised">
          {runs.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate text-ink/80">
                  {r.days} día(s) · {r.walletsCount} alumno(s)
                </p>
                <p className="truncate text-xs text-ink/40">
                  {formatDate(r.runAt)} ·{" "}
                  {r.trigger === "CRON" ? "automática" : "manual"}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-accent">
                {formatMoney(r.totalPaid)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------ Inflación ----------------------------- */

function InflationForm({ settings }: { settings: BankSettingsView }) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    updateInflationSettings,
    null,
  );
  const [forceState, forceAction] = useActionState<
    ActionResult | null,
    FormData
  >(forceInflation, null);

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Flame className="h-5 w-5 text-amber-300" />
        <CardTitle className="text-ink/80">Inflación</CardTitle>
      </div>
      <p className="mb-4 text-sm text-ink/50">
        Los precios de los cobros recurrentes suben solos todos los días según
        esta tasa. Sirve para mostrar que ganar intereses no alcanza si los
        precios corren más rápido.
      </p>

      <form action={action} className="flex flex-col gap-4">
        <label className="flex items-center gap-3 rounded-xl border border-raised2 bg-panel/60 px-4 py-3">
          <input
            type="checkbox"
            name="inflationEnabled"
            defaultChecked={settings.inflationEnabled}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-sm font-medium">Inflación activada</span>
        </label>

        <div>
          <Label htmlFor="infl">Inflación mensual (%)</Label>
          <Input
            id="infl"
            name="monthlyInflationPct"
            type="number"
            min="0"
            max="500"
            step="0.01"
            defaultValue={settings.monthlyInflationPct}
            required
          />
          <p className="mt-1 text-xs text-ink/40">
            Índice de precios actual: {settings.priceIndex.toFixed(2)} (arrancó
            en 100).
          </p>
        </div>

        <Result state={state} />
        <div>
          <Submit label="Guardar inflación" variant="secondary" />
        </div>
      </form>

      <form
        action={forceAction}
        className="mt-4 flex flex-col gap-3 border-t border-raised pt-4"
      >
        <p className="text-sm text-ink/50">
          Aplicar un mes entero de inflación de una, para verlo en vivo.
        </p>
        <Result state={forceState} />
        <div>
          <Submit
            label="Aplicar un mes de inflación"
            pendingLabel="Ajustando precios..."
            variant="outline"
            icon={Flame}
          />
        </div>
      </form>
    </Card>
  );
}

/* ------------------------------- Ranking ------------------------------ */

function EarnersCard({ earners }: { earners: { name: string; total: number }[] }) {
  const medal = ["🥇", "🥈", "🥉"];
  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-amber-300" />
        <CardTitle className="text-ink/80">
          Quiénes más ganaron con intereses
        </CardTitle>
      </div>
      {earners.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink/40">
          Todavía nadie ganó intereses.
        </p>
      ) : (
        <div className="divide-y divide-raised">
          {earners.map((e, i) => (
            <div
              key={`${e.name}-${i}`}
              className="flex items-center justify-between gap-3 py-2.5 text-sm"
            >
              <span className="truncate">
                {medal[i] ?? `${i + 1}.`} {e.name}
              </span>
              <span className="shrink-0 font-semibold text-accent">
                {formatMoney(e.total)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
