"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertTriangle,
  CalendarClock,
  FileSignature,
  Inbox,
  Ban,
} from "lucide-react";
import { cancelCheque, issueCheque } from "@/app/actions/cheques";
import type { ActionResult } from "@/app/actions/student";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  CHEQUE_STATUS_LABELS,
  CHEQUE_STATUS_TONES,
  formatChequeNumber,
} from "@/lib/cheques";
import { formatMoney, formatDate } from "@/lib/utils";
import { NoBankNotice } from "@/components/student/NoBankNotice";

export type ChequeView = {
  id: string;
  number: string;
  amount: number;
  concept: string | null;
  status: string;
  issuedAt: string;
  payableAt: string;
  deferred: boolean;
  daysToPayable: number;
  counterpartyName: string;
  bankName: string | null;
  fee: number | null;
  bounceReason: string | null;
};

export type PayeeOption = { id: string; name: string; group: string | null };

function Feedback({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p className={state.ok ? "text-sm text-accent" : "text-sm text-danger"}>
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

export function ChequesManager({
  drawn,
  received,
  payees,
  balance,
  canIssue,
}: {
  drawn: ChequeView[];
  received: ChequeView[];
  payees: PayeeOption[];
  balance: number;
  /** Para librar cheques hay que ser cliente de algún banco. */
  canIssue: boolean;
}) {
  // Lo que firmaste y todavía no te cobraron: la plata que ya no es tuya
  // aunque siga en la cuenta.
  const committed = useMemo(
    () =>
      drawn
        .filter((c) => c.status === "ISSUED")
        .reduce((acc, c) => acc + c.amount, 0),
    [drawn],
  );
  const bounced = drawn.filter((c) => c.status === "BOUNCED").length;

  return (
    <div className="flex flex-col gap-5">
      {committed > 0 && (
        <Card
          className={
            committed > balance
              ? "border-danger/40 bg-danger/5"
              : "border-raised bg-raised/20"
          }
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                committed > balance ? "text-danger" : "text-ink/40"
              }`}
            />
            <p className="text-sm leading-relaxed text-ink/70">
              Firmaste{" "}
              <span className="font-semibold">{formatMoney(committed)}</span> en
              cheques que todavía no cobraron, y tenés{" "}
              <span className="font-semibold">{formatMoney(balance)}</span> en la
              cuenta.{" "}
              {committed > balance ? (
                <span className="font-medium text-danger">
                  Si los presentan todos hoy, alguno va a rebotar.
                </span>
              ) : (
                "Te alcanza para todos."
              )}
            </p>
          </div>
        </Card>
      )}

      {bounced > 0 && (
        <Card className="border-danger/40 bg-danger/5">
          <p className="text-sm text-ink/70">
            Tenés{" "}
            <span className="font-semibold text-danger">
              {bounced} {bounced === 1 ? "cheque rechazado" : "cheques rechazados"}
            </span>
            . Los bancos lo ven cuando les pedís una tarjeta o un préstamo.
          </p>
        </Card>
      )}

      {canIssue ? (
        <IssueCheque payees={payees} />
      ) : (
        <NoBankNotice what="librar cheques" />
      )}

      <ChequeList
        title="Cheques que recibí"
        empty="Todavía no te dieron ningún cheque."
        icon={Inbox}
        cheques={received}
        role="payee"
      />

      <ChequeList
        title="Cheques que firmé"
        empty="Todavía no libraste ningún cheque."
        icon={FileSignature}
        cheques={drawn}
        role="drawer"
      />
    </div>
  );
}

function IssueCheque({ payees }: { payees: PayeeOption[] }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    issueCheque,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);
  const [deferred, setDeferred] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      setDeferred(false);
    }
  }, [state]);

  const payeeOptions = useMemo(
    () => payees.map((p) => ({ value: p.id, label: p.name, hint: p.group })),
    [payees],
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <FileSignature className="h-5 w-5 text-accent" />
        <CardTitle className="text-ink/80">Cargar un cheque</CardTitle>
      </div>
      <p className="mb-3 text-sm text-ink/50">
        Primero llenalo en papel y entregáselo a tu compañero. Acá cargás los
        mismos datos para que el banco lo pueda verificar cuando lo vaya a
        cobrar. <span className="text-ink/70">No se te descuenta nada ahora</span>
        : la plata sale recién cuando lo cobran.
      </p>

      <form ref={ref} action={formAction} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="ch-number">Número del cheque</Label>
            <Input
              id="ch-number"
              name="number"
              inputMode="numeric"
              placeholder="00001234"
              required
            />
          </div>
          <div>
            <Label htmlFor="ch-amount">Importe</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40">
                $
              </span>
              <Input
                id="ch-amount"
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
        </div>

        <div>
          <Label htmlFor="ch-payee">A la orden de</Label>
          <SearchSelect
            id="ch-payee"
            name="payeeId"
            options={payeeOptions}
            required
            placeholder="Elegí a quién se lo diste…"
            searchPlaceholder="Buscar por nombre o curso…"
            emptyMessage="No se encontró ningún compañero."
          />
        </div>

        <div>
          <Label htmlFor="ch-concept">Concepto (opcional)</Label>
          <Input
            id="ch-concept"
            name="concept"
            placeholder="Seña del pedido, publicidad..."
            maxLength={120}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink/70">
          <input
            type="checkbox"
            checked={deferred}
            onChange={(e) => setDeferred(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <CalendarClock className="h-4 w-4 text-ink/40" />
          Es un cheque diferido
        </label>

        {deferred ? (
          <div>
            <Label htmlFor="ch-payable">Fecha de pago</Label>
            <Input
              id="ch-payable"
              name="payableAt"
              type="date"
              min={today}
              defaultValue={today}
              required
            />
            <p className="mt-1.5 text-xs text-ink/45">
              Hasta esa fecha el banco no se lo paga. Por eso un cheque diferido
              vale menos que la misma plata hoy.
            </p>
          </div>
        ) : (
          <input type="hidden" name="payableAt" value="" />
        )}

        <Feedback state={state} />
        <div>
          <SubmitBtn label="Cargar cheque" />
        </div>
      </form>
    </Card>
  );
}

function ChequeList({
  title,
  empty,
  icon: Icon,
  cheques,
  role,
}: {
  title: string;
  empty: string;
  icon: typeof Inbox;
  cheques: ChequeView[];
  role: "drawer" | "payee";
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <Icon className="h-4 w-4 text-ink/40" />
        <CardTitle>{title}</CardTitle>
      </div>
      {cheques.length === 0 ? (
        <Card className="py-8 text-center text-sm text-ink/40">{empty}</Card>
      ) : (
        cheques.map((c) => <ChequeCard key={c.id} c={c} role={role} />)
      )}
    </section>
  );
}

function ChequeCard({ c, role }: { c: ChequeView; role: "drawer" | "payee" }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{formatMoney(c.amount)}</p>
          <p className="truncate text-xs text-ink/45">
            Nº {formatChequeNumber(c.number)} ·{" "}
            {role === "drawer" ? "a la orden de" : "de"} {c.counterpartyName}
          </p>
          {c.concept && (
            <p className="mt-1 truncate text-xs text-ink/40">{c.concept}</p>
          )}
        </div>
        <Badge tone={CHEQUE_STATUS_TONES[c.status] ?? "neutral"}>
          {CHEQUE_STATUS_LABELS[c.status] ?? c.status}
        </Badge>
      </div>

      <div className="mt-3 border-t border-raised pt-2.5 text-xs text-ink/50">
        {c.status === "ISSUED" && c.daysToPayable > 0 && (
          <p className="flex items-center gap-1.5 text-warning">
            <CalendarClock className="h-3.5 w-3.5" />
            Diferido: se cobra el {formatDate(c.payableAt)} (faltan{" "}
            {c.daysToPayable} {c.daysToPayable === 1 ? "día" : "días"})
          </p>
        )}
        {c.status === "ISSUED" && c.daysToPayable === 0 && (
          <p>
            {role === "payee"
              ? "Se puede cobrar: llevalo al mostrador de cualquier banco."
              : "En circulación: te lo pueden cobrar en cualquier momento."}
          </p>
        )}
        {c.status === "PAID" && (
          <p>
            Cobrado en {c.bankName ?? "el banco"}
            {c.fee ? ` · comisión ${formatMoney(c.fee)}` : ""}
          </p>
        )}
        {c.status === "BOUNCED" && (
          <p className="text-danger">
            Rechazado{c.bounceReason ? `: ${c.bounceReason}` : ""}
          </p>
        )}
        {c.status === "CANCELLED" && <p>Anulado por el librador.</p>}
      </div>

      {role === "drawer" && c.status === "ISSUED" && (
        <CancelCheque chequeId={c.id} />
      )}
    </Card>
  );
}

function CancelCheque({ chequeId }: { chequeId: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    cancelCheque,
    null,
  );
  const [confirming, setConfirming] = useState(false);

  if (state) {
    return (
      <p className={`mt-2 text-xs ${state.ok ? "text-ink/50" : "text-danger"}`}>
        {state.ok ? state.message : state.error}
      </p>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink/45 transition-colors hover:text-danger"
      >
        <Ban className="h-3 w-3" />
        Anular
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-warning/30 bg-warning/5 p-3">
      <p className="text-xs leading-relaxed text-ink/70">
        Si anulás el cheque, el banco no se lo va a pagar a tu compañero.
        Avisale antes: el papel lo sigue teniendo él.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <form action={formAction}>
          <input type="hidden" name="chequeId" value={chequeId} />
          <SubmitBtn label="Anular igual" variant="danger" />
        </form>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs text-ink/50 hover:text-ink"
        >
          Mejor no
        </button>
      </div>
    </div>
  );
}
