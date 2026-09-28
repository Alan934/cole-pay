"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, ShieldX } from "lucide-react";
import { approveLoan, rejectLoan } from "@/app/actions/loans";
import type { ActionResult } from "@/app/actions/student";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { quoteLoan } from "@/lib/loans";
import { formatDate, formatMoney } from "@/lib/utils";

export type LoanReviewData = {
  id: string;
  bankName: string;
  borrowerName: string;
  borrowerTaxId: string | null;
  borrowerGroup: string | null;
  borrowerBalance: number;
  /** Lo que ya le debe al banco por la tarjeta, si tiene. */
  cardDebt: number;
  requestedAmount: number;
  requestedInstallments: number;
  monthlyIncome: number | null;
  purpose: string | null;
  createdAt: string;
  /** Tasa mensual y tope que tiene cargados el banco. */
  bankRatePct: number;
  bankMaxLoan: number;
  /** Caja del banco: no puede prestar más de lo que tiene. */
  bankBalance: number;
};

/**
 * Mostrador de préstamos: el banco mira quién pide, cuánto gana y cuánto ya
 * debe, y decide el monto, la tasa y las cuotas. La cuenta se muestra en vivo
 * para que vean cuánto termina devolviendo el cliente.
 */
export function LoanReview({
  loan,
  showBank = false,
}: {
  loan: LoanReviewData;
  showBank?: boolean;
}) {
  const [tab, setTab] = useState<"none" | "approve" | "reject">("none");

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">{loan.borrowerName}</h3>
            {loan.borrowerGroup && (
              <Badge tone="neutral">{loan.borrowerGroup}</Badge>
            )}
            {showBank && <Badge tone="violet">{loan.bankName}</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-ink/45">
            {loan.borrowerTaxId ?? "Sin DNI/CUIT cargado"} ·{" "}
            {formatDate(loan.createdAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink/45">Pide</p>
          <p className="text-lg font-bold">
            {formatMoney(loan.requestedAmount)}
          </p>
          <p className="text-xs text-ink/45">
            en {loan.requestedInstallments} cuotas
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Fact
          label="Ingreso declarado"
          value={
            loan.monthlyIncome === null
              ? "No lo declaró"
              : formatMoney(loan.monthlyIncome)
          }
        />
        <Fact
          label="Saldo en la billetera"
          value={formatMoney(loan.borrowerBalance)}
        />
        <Fact label="Ya debe (tarjeta)" value={formatMoney(loan.cardDebt)} />
        <Fact label="Caja del banco" value={formatMoney(loan.bankBalance)} />
      </dl>

      {loan.purpose && (
        <p className="rounded-xl bg-raised/50 px-3 py-2.5 text-sm text-ink/70">
          <span className="font-medium text-ink/85">Para qué lo quiere: </span>
          {loan.purpose}
        </p>
      )}

      {loan.requestedAmount > loan.bankBalance && (
        <p className="rounded-xl border border-warning/35 bg-warning/5 px-3 py-2 text-xs text-ink/65">
          Ojo: el banco no tiene caja para prestar todo lo que pide. Podés darle
          menos o pedirle a la profe que capitalice el banco.
        </p>
      )}

      {tab === "none" && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setTab("approve")}>
            <Check className="h-4 w-4" />
            Aprobar y desembolsar
          </Button>
          <Button variant="outline" onClick={() => setTab("reject")}>
            <ShieldX className="h-4 w-4" />
            Rechazar
          </Button>
        </div>
      )}

      {tab === "approve" && (
        <ApproveForm loan={loan} onCancel={() => setTab("none")} />
      )}
      {tab === "reject" && (
        <RejectForm loanId={loan.id} onCancel={() => setTab("none")} />
      )}
    </Card>
  );
}

function ApproveForm({
  loan,
  onCancel,
}: {
  loan: LoanReviewData;
  onCancel: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    approveLoan,
    null,
  );
  const [principal, setPrincipal] = useState(loan.requestedAmount);
  const [rate, setRate] = useState(loan.bankRatePct);
  const [installments, setInstallments] = useState(loan.requestedInstallments);

  const quote = quoteLoan(principal, rate, installments);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-accent/30 bg-accent/5 p-4"
    >
      <input type="hidden" name="loanId" value={loan.id} />

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor={`cap-${loan.id}`}>Capital que le prestan</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40">
              $
            </span>
            <Input
              id={`cap-${loan.id}`}
              name="principal"
              type="number"
              min="1"
              step="0.01"
              className="pl-8"
              value={principal}
              onChange={(e) => setPrincipal(Number(e.target.value))}
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor={`rate-${loan.id}`}>Interés mensual (%)</Label>
          <Input
            id={`rate-${loan.id}`}
            name="monthlyRatePct"
            type="number"
            min="0"
            max="200"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            required
          />
        </div>
        <div>
          <Label htmlFor={`inst-${loan.id}`}>Cuotas</Label>
          <Input
            id={`inst-${loan.id}`}
            name="installments"
            type="number"
            min="1"
            max="24"
            value={installments}
            onChange={(e) => setInstallments(Number(e.target.value))}
            required
          />
        </div>
      </div>

      <div className="rounded-xl border border-raised2 bg-panel/60 p-3">
        <p className="text-xs text-ink/50">{quote.formula}</p>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
          <Fact label="Devuelve en total" value={formatMoney(quote.total)} />
          <Fact label="Intereses" value={formatMoney(quote.interest)} />
          <Fact
            label={`Cuota (×${quote.installments})`}
            value={formatMoney(quote.installmentAmount)}
          />
        </dl>
      </div>

      <div>
        <Label htmlFor={`note-${loan.id}`}>
          Comentario para el cliente (opcional)
        </Label>
        <Textarea
          id={`note-${loan.id}`}
          name="note"
          rows={2}
          maxLength={200}
          placeholder="Ej: te damos menos de lo que pediste hasta ver cómo pagás las cuotas."
        />
      </div>

      {state && (
        <FormFeedback
          ok={state.ok}
          msg={state.ok ? state.message : state.error}
        />
      )}

      <div className="flex gap-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Volver
        </Button>
        <SubmitButton idle="Desembolsar el préstamo" busy="Desembolsando..." />
      </div>
    </form>
  );
}

function RejectForm({
  loanId,
  onCancel,
}: {
  loanId: string;
  onCancel: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    rejectLoan,
    null,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4"
    >
      <input type="hidden" name="loanId" value={loanId} />
      <div>
        <Label htmlFor={`reason-${loanId}`}>Motivo del rechazo</Label>
        <Textarea
          id={`reason-${loanId}`}
          name="reason"
          rows={2}
          maxLength={200}
          placeholder="Ej: todavía estás pagando el resumen de la tarjeta."
          required
        />
        <p className="mt-1.5 px-1 text-xs text-ink/40">
          El motivo le llega al alumno como aviso: escribí algo que le sirva
          para volver a intentarlo.
        </p>
      </div>

      {state && (
        <FormFeedback
          ok={state.ok}
          msg={state.ok ? state.message : state.error}
        />
      )}

      <div className="flex gap-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Volver
        </Button>
        <SubmitButton idle="Rechazar" busy="Rechazando..." danger />
      </div>
    </form>
  );
}

function SubmitButton({
  idle,
  busy,
  danger,
}: {
  idle: string;
  busy: string;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={danger ? "danger" : "primary"}
      className="flex-1"
      disabled={pending}
    >
      {pending ? busy : idle}
    </Button>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-raised/50 px-3 py-2">
      <dt className="text-[11px] text-ink/45">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );
}
