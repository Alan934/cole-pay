"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cancelLoan, payLoanInstallment } from "@/app/actions/loans";
import type { ActionResult } from "@/app/actions/student";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { loanProgress } from "@/lib/loans";
import { formatDate, formatMoney, cn } from "@/lib/utils";

export type LoanView = {
  id: string;
  bankName: string;
  color: string;
  status: string;
  requestedAmount: number;
  requestedInstallments: number;
  purpose: string | null;
  reviewNote: string | null;
  createdAt: string;
  principal: number | null;
  monthlyRatePct: number | null;
  installments: number | null;
  installmentAmount: number | null;
  totalToRepay: number | null;
  paidAmount: number;
  disbursedAt: string | null;
};

const STATUS: Record<
  string,
  { label: string; tone: "warning" | "success" | "danger" | "neutral" | "violet" }
> = {
  PENDING: { label: "Esperando respuesta", tone: "warning" },
  ACTIVE: { label: "Pagando cuotas", tone: "violet" },
  PAID: { label: "Pagado", tone: "success" },
  REJECTED: { label: "Rechazado", tone: "danger" },
  CANCELLED: { label: "Dado de baja", tone: "neutral" },
};

export function LoanPanel({ loan }: { loan: LoanView }) {
  const badge = STATUS[loan.status] ?? {
    label: loan.status,
    tone: "neutral" as const,
  };
  const progress = loanProgress(loan);
  const active = loan.status === "ACTIVE";

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="h-10 w-10 shrink-0 rounded-xl"
            style={{ backgroundColor: loan.color }}
          />
          <div className="min-w-0">
            <p className="truncate font-semibold">{loan.bankName}</p>
            <p className="text-xs text-ink/45">
              Pediste {formatMoney(loan.requestedAmount)} ·{" "}
              {formatDate(loan.createdAt)}
            </p>
          </div>
        </div>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>

      {loan.reviewNote && (
        <p className="rounded-xl bg-raised/50 px-3 py-2 text-xs text-ink/60">
          <span className="font-medium text-ink/80">Respuesta del banco: </span>
          {loan.reviewNote}
        </p>
      )}

      {(active || loan.status === "PAID") && loan.totalToRepay !== null && (
        <>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Mini
              label="Te prestaron"
              value={formatMoney(loan.principal ?? 0)}
            />
            <Mini label="Devolvés" value={formatMoney(progress.total)} />
            <Mini
              label={`Cuota (×${progress.installments})`}
              value={formatMoney(progress.installmentAmount)}
            />
            <Mini
              label="Interés mensual"
              value={`${loan.monthlyRatePct ?? 0}%`}
            />
          </dl>

          <div>
            <div className="flex items-baseline justify-between text-xs text-ink/50">
              <span>
                {progress.paidInstallments} de {progress.installments} cuotas
              </span>
              <span>Te faltan {formatMoney(progress.remaining)}</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-raised2">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  loan.status === "PAID" ? "bg-accent" : "bg-violet",
                )}
                style={{ width: `${Math.max(progress.paidPct, 2)}%` }}
              />
            </div>
          </div>
        </>
      )}

      {active && progress.remaining > 0 && (
        <PayLoanForm loanId={loan.id} progress={progress} />
      )}

      {loan.status === "PENDING" && <CancelLoanForm loanId={loan.id} />}
    </Card>
  );
}

function PayLoanForm({
  loanId,
  progress,
}: {
  loanId: string;
  progress: ReturnType<typeof loanProgress>;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    payLoanInstallment,
    null,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-violet/30 bg-violet/5 p-4"
    >
      <input type="hidden" name="loanId" value={loanId} />
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Pagar la cuota</p>
          <p className="text-xs text-ink/50">
            Sale de tu saldo disponible.
          </p>
        </div>
        <p className="text-xl font-bold">
          {formatMoney(progress.nextPayment)}
        </p>
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
            max={progress.remaining}
            step="0.01"
            defaultValue={progress.nextPayment}
            aria-label="Monto a pagar"
            className="pl-7"
            required
          />
        </div>
        <PaySubmit />
      </div>

      <p className="text-xs text-ink/45">
        Podés adelantar cuotas: si pagás más, terminás antes y no cambia el
        total, porque el interés se pactó al principio.
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

function CancelLoanForm({ loanId }: { loanId: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    cancelLoan,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="loanId" value={loanId} />
      <CancelSubmit />
      {state && !state.ok && <FormFeedback ok={false} msg={state.error} />}
    </form>
  );
}

function CancelSubmit() {
  // `useFormStatus` sólo ve el estado del form si vive adentro de él.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="sm" disabled={pending}>
      {pending ? "Dando de baja..." : "Dar de baja el pedido"}
    </Button>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-raised/50 px-3 py-2">
      <dt className="text-[11px] text-ink/45">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );
}
