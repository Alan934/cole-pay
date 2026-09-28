"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarClock, ChevronDown, Percent, Receipt } from "lucide-react";
import { payStatement } from "@/app/actions/cards";
import type { ActionResult } from "@/app/actions/student";
import {
  CreditCardVisual,
  type CardVisualData,
} from "@/components/cards/CreditCardVisual";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { formatDate, formatMoney, cn } from "@/lib/utils";
import type { CardBalance } from "@/lib/cards";

export type ChargeView = {
  id: string;
  kind: string;
  amount: number;
  description: string;
  createdAt: string;
};

export type StatementView = {
  id: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: string;
  previousBalance: number;
  chargesTotal: number;
  interest: number;
  total: number;
  paid: number;
  charges: ChargeView[];
};

export type CardView = {
  id: string;
  visual: CardVisualData;
  bankName: string;
  balance: CardBalance;
  monthlyRatePct: number;
  dueDays: number;
  nextClosing: string;
  currentCharges: ChargeView[];
  statements: StatementView[];
};

const STATEMENT_TONES: Record<
  string,
  { label: string; tone: "warning" | "success" | "danger" | "neutral" }
> = {
  CLOSED: { label: "A pagar", tone: "warning" },
  PAID: { label: "Pagado", tone: "success" },
  OVERDUE: { label: "Vencido", tone: "danger" },
  ROLLED: { label: "Pasó al siguiente", tone: "neutral" },
};

export function CardPanel({ card }: { card: CardView }) {
  const { balance } = card;
  // El primer resumen impago es el que se puede pagar; los anteriores ya
  // fueron arrastrados o cancelados.
  const payable = card.statements.find(
    (s) => (s.status === "CLOSED" || s.status === "OVERDUE") && s.total > s.paid,
  );

  return (
    <Card className="flex flex-col gap-5">
      {/* Se apila siempre: la columna del alumno es angosta y en dos
          columnas los números quedan ilegibles. */}
      <div className="flex flex-col items-center gap-5">
        <CreditCardVisual card={card.visual} />

        <div className="w-full min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <CardTitle className="text-ink/70">Límite disponible</CardTitle>
            <span className="text-xs text-ink/40">
              de {formatMoney(balance.limit)}
            </span>
          </div>
          <p className="text-2xl font-bold text-accent">
            {formatMoney(balance.available)}
          </p>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-raised2">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                balance.usedPct > 85 ? "bg-danger" : "bg-violet",
              )}
              style={{ width: `${Math.max(balance.usedPct, 2)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink/45">
            Usaste {formatMoney(balance.debt)} ({Math.round(balance.usedPct)}%)
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <Mini
              icon={Receipt}
              label="Período en curso"
              value={formatMoney(balance.currentPeriod)}
            />
            <Mini
              icon={Receipt}
              label="Resúmenes impagos"
              value={formatMoney(balance.billed)}
            />
            <Mini
              icon={CalendarClock}
              label="Próximo cierre"
              value={new Date(card.nextClosing).toLocaleDateString("es-AR")}
            />
            <Mini
              icon={Percent}
              label="Interés mensual"
              value={`${card.monthlyRatePct}%`}
            />
          </dl>
        </div>
      </div>

      {payable ? (
        <PayStatementForm statement={payable} />
      ) : (
        balance.currentPeriod > 0 && (
          <p className="rounded-xl border border-raised2/70 bg-raised/50 px-3 py-2.5 text-sm text-ink/55">
            Todavía no hay nada que pagar: estos consumos se van a facturar
            cuando {card.bankName} cierre el resumen, el{" "}
            {new Date(card.nextClosing).toLocaleDateString("es-AR")}.
          </p>
        )
      )}

      {card.currentCharges.length > 0 && (
        <Section title="Consumos del período en curso">
          <ChargeList charges={card.currentCharges} />
        </Section>
      )}

      {card.statements.length > 0 && (
        <Section title="Resúmenes">
          <div className="flex flex-col gap-2">
            {card.statements.map((s) => (
              <StatementRow key={s.id} statement={s} />
            ))}
          </div>
        </Section>
      )}
    </Card>
  );
}

/** Formulario de pago del resumen: total o una parte. */
function PayStatementForm({ statement }: { statement: StatementView }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    payStatement,
    null,
  );
  const remaining = Number((statement.total - statement.paid).toFixed(2));
  const overdue = statement.status === "OVERDUE";

  return (
    <form
      action={formAction}
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4",
        overdue
          ? "border-danger/40 bg-danger/5"
          : "border-warning/35 bg-warning/5",
      )}
    >
      <input type="hidden" name="statementId" value={statement.id} />
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {overdue ? "Resumen vencido" : "Resumen a pagar"}
          </p>
          <p className="text-xs text-ink/50">
            {overdue ? "Venció el " : "Vence el "}
            {new Date(statement.dueDate).toLocaleDateString("es-AR")}
          </p>
        </div>
        <p className="text-xl font-bold">{formatMoney(remaining)}</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40">
            $
          </span>
          <Input
            name="amount"
            type="number"
            min="0.01"
            max={remaining}
            step="0.01"
            defaultValue={remaining}
            aria-label="Monto a pagar"
            className="pl-7"
            required
          />
        </div>
        <PaySubmit />
      </div>

      <p className="text-xs text-ink/45">
        Si pagás menos del total, lo que quede pasa al próximo resumen con
        interés.
      </p>

      {state && (
        <FormFeedback
          ok={state.ok}
          msg={state.ok ? state.message : state.error}
        />
      )}
    </form>
  );
}

function PaySubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Pagando..." : "Pagar"}
    </Button>
  );
}

/** Una fila de resumen, desplegable para ver el detalle. */
function StatementRow({ statement }: { statement: StatementView }) {
  const [open, setOpen] = useState(false);
  const badge = STATEMENT_TONES[statement.status] ?? {
    label: statement.status,
    tone: "neutral" as const,
  };

  return (
    <div className="rounded-xl border border-raised2/70 bg-raised/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            Cierre {new Date(statement.periodEnd).toLocaleDateString("es-AR")}
          </p>
          <p className="text-xs text-ink/45">
            Vence {new Date(statement.dueDate).toLocaleDateString("es-AR")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          <span className="font-semibold">{formatMoney(statement.total)}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-ink/40 transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-raised2/70 px-3 py-3">
          <dl className="flex flex-col gap-1 text-sm">
            <Line label="Saldo anterior" value={statement.previousBalance} />
            <Line label="Consumos del período" value={statement.chargesTotal} />
            <Line label="Interés por financiar" value={statement.interest} />
            <Line label="Total del resumen" value={statement.total} strong />
            <Line label="Pagado" value={statement.paid} />
          </dl>
          {statement.charges.length > 0 && (
            <div className="mt-3 border-t border-raised2/70 pt-2">
              <ChargeList charges={statement.charges} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChargeList({ charges }: { charges: ChargeView[] }) {
  return (
    <ul className="divide-y divide-raised2/60">
      {charges.map((c) => (
        <li
          key={c.id}
          className="flex items-center justify-between gap-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <p className="truncate text-ink/85">{c.description}</p>
            <p className="text-xs text-ink/40">{formatDate(c.createdAt)}</p>
          </div>
          <span
            className={cn(
              "shrink-0 font-medium",
              c.kind === "INTEREST" && "text-danger",
            )}
          >
            {formatMoney(c.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-raised2/60 pt-4">
      <CardTitle className="mb-2">{title}</CardTitle>
      {children}
    </div>
  );
}

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink/50">{label}</dt>
      <dd className={strong ? "font-bold" : "font-medium"}>
        {formatMoney(value)}
      </dd>
    </div>
  );
}

function Mini({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Receipt;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-raised/50 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-ink/45">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}
