"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Repeat, Play, Pause, Zap, Search } from "lucide-react";
import {
  createRecurring,
  toggleRecurring,
  runRecurringNow,
} from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/student";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { formatMoney, formatDate } from "@/lib/utils";

type GroupOpt = { id: string; name: string };
export type RecurringView = {
  id: string;
  description: string;
  amount: number;
  intervalDays: number;
  active: boolean;
  groupName: string | null;
  nextRunAt: string;
  due: boolean;
};

function Submit({ label, icon }: { label: string; icon?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {icon}
      {pending ? "..." : label}
    </Button>
  );
}

export function RecurringManager({
  charges,
  groups,
  dueCount,
}: {
  charges: RecurringView[];
  groups: GroupOpt[];
  dueCount: number;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return charges;
    return charges.filter((c) =>
      `${c.description} ${c.groupName ?? ""}`.toLowerCase().includes(q),
    );
  }, [charges, query]);

  return (
    <div className="flex flex-col gap-5">
      <CreateForm groups={groups} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Programados ({filtered.length})</CardTitle>
          <div className="flex items-center gap-2">
            {charges.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar…"
                  className="h-10 pl-9 sm:w-56"
                />
              </div>
            )}
            <RunNow dueCount={dueCount} />
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card className="py-8 text-center text-sm text-ink/40">
            {charges.length === 0
              ? "No hay cobros recurrentes programados."
              : "Sin resultados."}
          </Card>
        ) : (
          filtered.map((c) => <RecurringCard key={c.id} c={c} />)
        )}
      </section>
    </div>
  );
}

function CreateForm({ groups }: { groups: GroupOpt[] }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    createRecurring,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Repeat className="h-5 w-5 text-accent" />
        <CardTitle className="text-ink/80">Nuevo cobro recurrente</CardTitle>
      </div>
      <form ref={ref} action={formAction} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="rc-desc">Concepto</Label>
            <Input
              id="rc-desc"
              name="description"
              placeholder="ej: Alquiler semanal del stand"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="rc-amount">Monto</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40">
                  $
                </span>
                <Input
                  id="rc-amount"
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
              <Label htmlFor="rc-interval">Cada (días)</Label>
              <Input
                id="rc-interval"
                name="intervalDays"
                type="number"
                min="1"
                max="90"
                defaultValue={7}
                required
              />
            </div>
          </div>
        </div>
        <div>
          <Label htmlFor="rc-group">Grupo</Label>
          <Select id="rc-group" name="groupId" defaultValue="" required>
            <option value="" disabled>
              Seleccioná un grupo…
            </option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </div>
        {state && (
          <FormFeedback ok={state.ok} msg={state.ok ? state.message : state.error} />
        )}
        <div>
          <Submit label="Programar" />
        </div>
      </form>
    </Card>
  );
}

/**
 * Se renderiza siempre (aunque no haya vencidos) para que el mensaje de
 * resultado siga visible después de generar los cobros.
 */
function RunNow({ dueCount }: { dueCount: number }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    runRecurringNow,
    null,
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      {state && (
        <span className={state.ok ? "text-xs text-accent" : "text-xs text-red-300"}>
          {state.ok ? state.message : state.error}
        </span>
      )}
      <RunNowButton disabled={dueCount === 0} />
    </form>
  );
}

function RunNowButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      disabled={pending || disabled}
      title={
        disabled ? "No hay cobros recurrentes vencidos" : "Generar cobros vencidos"
      }
    >
      <Zap className="h-4 w-4" />
      {pending ? "..." : "Generar vencidos"}
    </Button>
  );
}

function RecurringCard({ c }: { c: RecurringView }) {
  const [, toggleAction] = useActionState<ActionResult | null, FormData>(
    toggleRecurring,
    null,
  );
  return (
    <Card className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
          <Repeat className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold">{c.description}</p>
          <p className="text-xs text-ink/40">
            {formatMoney(c.amount)} · cada {c.intervalDays} días ·{" "}
            {c.groupName ?? "sin grupo"}
          </p>
          <p className="text-xs text-ink/40">
            Próximo: {formatDate(c.nextRunAt)}
            {c.due && c.active && (
              <span className="ml-1 text-amber-300">· vencido</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {c.active ? (
          <Badge tone="success">Activo</Badge>
        ) : (
          <Badge tone="neutral">Pausado</Badge>
        )}
        <form action={toggleAction}>
          <input type="hidden" name="recurringId" value={c.id} />
          <button
            type="submit"
            title={c.active ? "Pausar" : "Reactivar"}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 hover:bg-raised2 hover:text-ink"
          >
            {c.active ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>
    </Card>
  );
}
