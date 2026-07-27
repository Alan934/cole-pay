"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Target,
  Plus,
  PiggyBank,
  ArrowDownToLine,
  Trash2,
  Lock,
  TrendingUp,
} from "lucide-react";
import {
  createGoal,
  moveGoalFunds,
  deleteGoal,
} from "@/app/actions/features";
import type { ActionResult } from "@/app/actions/student";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatMoney, formatDate } from "@/lib/utils";
import { simpleInterest } from "@/lib/interest";

export type GoalView = {
  id: string;
  name: string;
  target: number;
  saved: number;
  earned: number;
  completed: boolean;
  /** Fecha hasta la que no se puede retirar, o null si está libre. */
  lockedUntil: string | null;
};

function Feedback({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p
      className={
        state.ok
          ? "text-sm text-accent"
          : "text-sm text-red-300"
      }
    >
      {state.ok ? state.message : state.error}
    </p>
  );
}

export function GoalsManager({
  goals,
  balance,
  tnaPct,
  lockDays,
}: {
  goals: GoalView[];
  balance: number;
  tnaPct: number;
  lockDays: number;
}) {
  return (
    <div className="flex flex-col gap-5">
      {tnaPct > 0 && (
        <Card className="border-accent/25 bg-accent/5">
          <div className="mb-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            <CardTitle className="text-ink/80">
              Lo que apartás acá rinde {tnaPct}% TNA
            </CardTitle>
          </div>
          <p className="text-sm leading-relaxed text-ink/60">
            El interés se suma solo a la meta todos los días, así que llegás
            antes.
            {lockDays > 0 && (
              <>
                {" "}
                A cambio, cada vez que apartás plata queda{" "}
                <span className="font-medium text-ink/80">
                  bloqueada {lockDays} día(s)
                </span>{" "}
                antes de poder retirarla. Ese es el trato: más tasa a cambio de
                menos libertad.
              </>
            )}
          </p>
        </Card>
      )}

      <CreateGoal />
      {goals.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center text-ink/40">
          <Target className="h-8 w-8" />
          <p className="text-sm">
            Todavía no tenés metas. ¡Creá una y empezá a ahorrar!
          </p>
        </Card>
      ) : (
        goals.map((g) => (
          <GoalCard key={g.id} goal={g} balance={balance} tnaPct={tnaPct} />
        ))
      )}
    </div>
  );
}

function CreateGoal() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    createGoal,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Target className="h-5 w-5 text-accent" />
        <CardTitle className="text-ink/80">Nueva meta de ahorro</CardTitle>
      </div>
      <form ref={ref} action={formAction} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="g-name">¿Para qué ahorrás?</Label>
            <Input id="g-name" name="name" placeholder="ej: Campera nueva" required />
          </div>
          <div>
            <Label htmlFor="g-target">Meta</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40">
                $
              </span>
              <Input
                id="g-target"
                name="targetAmount"
                type="number"
                min="1"
                step="0.01"
                placeholder="0,00"
                className="pl-7"
                required
              />
            </div>
          </div>
        </div>
        <Feedback state={state} />
        <div>
          <SubmitBtn icon={<Plus className="h-4 w-4" />} label="Crear meta" />
        </div>
      </form>
    </Card>
  );
}

function GoalCard({
  goal,
  balance,
  tnaPct,
}: {
  goal: GoalView;
  balance: number;
  tnaPct: number;
}) {
  const [mode, setMode] = useState<"deposit" | "withdraw" | null>(null);
  const pct = Math.min(100, Math.round((goal.saved / goal.target) * 100));
  const locked = goal.lockedUntil !== null;
  const perDay = simpleInterest(goal.saved, tnaPct, 1);

  return (
    <Card>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
            <PiggyBank className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">{goal.name}</p>
            <p className="text-xs text-ink/40">
              {formatMoney(goal.saved)} de {formatMoney(goal.target)}
            </p>
          </div>
        </div>
        {goal.completed ? (
          <Badge tone="success">¡Completada!</Badge>
        ) : (
          <Badge tone="accent">{pct}%</Badge>
        )}
      </div>

      {/* Barra de progreso */}
      <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-raised">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {(perDay > 0 || goal.earned > 0) && (
        <p className="mb-3 text-xs text-ink/50">
          {perDay > 0 && (
            <>
              Genera{" "}
              <span className="font-medium text-accent">
                {formatMoney(perDay)}
              </span>{" "}
              por día
            </>
          )}
          {perDay > 0 && goal.earned > 0 && " · "}
          {goal.earned > 0 && (
            <>
              Ya sumó{" "}
              <span className="font-medium text-accent">
                {formatMoney(goal.earned)}
              </span>{" "}
              de interés
            </>
          )}
        </p>
      )}

      {locked && (
        <p className="mb-3 flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/5 px-2.5 py-1.5 text-xs text-amber-300">
          <Lock className="h-3 w-3 shrink-0" />
          Podés retirar a partir del {formatDate(goal.lockedUntil!)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setMode("deposit")}>
          <PiggyBank className="h-4 w-4" /> Apartar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setMode("withdraw")}
          disabled={goal.saved <= 0 || locked}
        >
          <ArrowDownToLine className="h-4 w-4" /> Retirar
        </Button>
        <DeleteGoal goalId={goal.id} />
      </div>

      {mode && (
        <MoveForm
          goalId={goal.id}
          direction={mode}
          balance={balance}
          saved={goal.saved}
          onClose={() => setMode(null)}
        />
      )}
    </Card>
  );
}

function MoveForm({
  goalId,
  direction,
  balance,
  saved,
  onClose,
}: {
  goalId: string;
  direction: "deposit" | "withdraw";
  balance: number;
  saved: number;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    moveGoalFunds,
    null,
  );
  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(onClose, 500);
      return () => clearTimeout(t);
    }
  }, [state, onClose]);

  const max = direction === "deposit" ? balance : saved;

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2 border-t border-raised pt-3">
      <input type="hidden" name="goalId" value={goalId} />
      <input type="hidden" name="direction" value={direction} />
      <Label htmlFor={`amt-${goalId}`}>
        {direction === "deposit" ? "¿Cuánto apartás?" : "¿Cuánto retirás?"}
      </Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40">
            $
          </span>
          <Input
            id={`amt-${goalId}`}
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            max={max}
            placeholder="0,00"
            className="pl-7"
            required
          />
        </div>
        <SubmitBtn label={direction === "deposit" ? "Apartar" : "Retirar"} />
      </div>
      <p className="text-xs text-ink/40">
        {direction === "deposit"
          ? `Disponible: ${formatMoney(balance)}`
          : `Ahorrado: ${formatMoney(saved)}`}
      </p>
      <Feedback state={state} />
    </form>
  );
}

function DeleteGoal({ goalId }: { goalId: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    deleteGoal,
    null,
  );
  useEffect(() => {
    void state;
  }, [state]);
  return (
    <form action={formAction} className="ml-auto">
      <input type="hidden" name="goalId" value={goalId} />
      <button
        type="submit"
        title="Eliminar meta"
        className="grid h-8 w-8 place-items-center rounded-lg text-ink/40 hover:bg-red-500/15 hover:text-red-300"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </form>
  );
}

function SubmitBtn({ label, icon }: { label: string; icon?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {icon}
      {pending ? "..." : label}
    </Button>
  );
}
