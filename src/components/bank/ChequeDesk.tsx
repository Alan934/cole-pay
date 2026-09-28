"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  CalendarClock,
  Percent,
  Search,
  FilePlus2,
  ShieldAlert,
} from "lucide-react";
import {
  cashCheque,
  registerChequeAtCounter,
  rejectCheque,
  saveChequeFee,
} from "@/app/actions/cheques";
import type { ActionResult } from "@/app/actions/student";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  CHEQUE_STATUS_LABELS,
  CHEQUE_STATUS_TONES,
  chequeFee,
  chequeNetAmount,
  formatChequeNumber,
} from "@/lib/cheques";
import { formatDate, formatMoney } from "@/lib/utils";

export type DeskChequeView = {
  id: string;
  number: string;
  amount: number;
  concept: string | null;
  status: string;
  payableAt: string;
  daysToPayable: number;
  drawerName: string;
  drawerGroup: string | null;
  drawerBalance: number;
  drawerBounced: number;
  payeeName: string;
  bankName: string | null;
  fee: number | null;
  bounceReason: string | null;
};

export type StudentOption = { id: string; name: string; group: string | null };

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
  size = "sm",
}: {
  label: string;
  variant?: "primary" | "outline" | "danger";
  size?: "sm" | "md";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size={size} variant={variant} disabled={pending}>
      {pending ? "..." : label}
    </Button>
  );
}

export function ChequeDesk({
  pending,
  history,
  students,
  feePct,
  bankName,
}: {
  pending: DeskChequeView[];
  history: DeskChequeView[];
  students: StudentOption[];
  feePct: number;
  bankName: string;
}) {
  const [query, setQuery] = useState("");

  const { payableNow, deferred } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (c: DeskChequeView) =>
      !q ||
      c.number.includes(q.replace(/\s/g, "")) ||
      c.drawerName.toLowerCase().includes(q) ||
      c.payeeName.toLowerCase().includes(q);
    const filtered = pending.filter(match);
    return {
      payableNow: filtered.filter((c) => c.daysToPayable === 0),
      deferred: filtered.filter((c) => c.daysToPayable > 0),
    };
  }, [pending, query]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <FeeForm feePct={feePct} />
        <RegisterCheque students={students} />
      </div>

      <div>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por número, librador o beneficiario"
            className="pl-10"
          />
        </div>

        <section className="flex flex-col gap-3">
          <CardTitle className="px-1">
            Para cobrar hoy ({payableNow.length})
          </CardTitle>
          {payableNow.length === 0 ? (
            <Card className="py-8 text-center text-sm text-ink/40">
              No hay cheques presentables en este momento.
            </Card>
          ) : (
            payableNow.map((c) => (
              <DeskChequeCard
                key={c.id}
                c={c}
                feePct={feePct}
                bankName={bankName}
                actionable
              />
            ))
          )}
        </section>
      </div>

      {deferred.length > 0 && (
        <section className="flex flex-col gap-3">
          <CardTitle className="px-1">
            Diferidos, todavía no vencen ({deferred.length})
          </CardTitle>
          {deferred.map((c) => (
            <DeskChequeCard
              key={c.id}
              c={c}
              feePct={feePct}
              bankName={bankName}
            />
          ))}
        </section>
      )}

      {history.length > 0 && (
        <section className="flex flex-col gap-3">
          <CardTitle className="px-1">Ya pasaron por tu ventanilla</CardTitle>
          {history.map((c) => (
            <DeskChequeCard
              key={c.id}
              c={c}
              feePct={feePct}
              bankName={bankName}
            />
          ))}
        </section>
      )}
    </div>
  );
}

/** Cuánto cobra el banco por hacer efectivo un cheque. */
function FeeForm({ feePct }: { feePct: number }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    saveChequeFee,
    null,
  );
  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <Percent className="h-5 w-5 text-violet" />
        <CardTitle className="text-ink/80">Comisión por cheque</CardTitle>
      </div>
      <p className="mb-3 text-sm text-ink/50">
        Lo que te quedás de cada cheque que hacés efectivo. Se descuenta de lo
        que cobra el beneficiario.
      </p>
      <form action={formAction} className="flex items-end gap-2">
        <div className="w-32">
          <Label htmlFor="fee">% del importe</Label>
          <Input
            id="fee"
            name="chequeFeePct"
            type="number"
            min="0"
            max="50"
            step="0.01"
            defaultValue={feePct}
          />
        </div>
        <SubmitBtn label="Guardar" size="md" />
      </form>
      <div className="mt-2">
        <Feedback state={state} />
      </div>
    </Card>
  );
}

/** Alta de un cheque de papel que nadie cargó en la app. */
function RegisterCheque({ students }: { students: StudentOption[] }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    registerChequeAtCounter,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  const options = useMemo(
    () =>
      students.map((s) => ({ value: s.id, label: s.name, hint: s.group })),
    [students],
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <FilePlus2 className="h-5 w-5 text-accent" />
        <CardTitle className="text-ink/80">Cargar un cheque de papel</CardTitle>
      </div>
      <p className="mb-3 text-sm text-ink/50">
        Si el cheque no está en el sistema, cargalo vos con el papel a la vista.
        Nunca lo carga el que lo viene a cobrar.
      </p>

      {!open ? (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          Cargar cheque
        </Button>
      ) : (
        <form ref={ref} action={formAction} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="r-number">Número</Label>
              <Input
                id="r-number"
                name="number"
                inputMode="numeric"
                placeholder="00001234"
                required
              />
            </div>
            <div>
              <Label htmlFor="r-amount">Importe</Label>
              <Input
                id="r-amount"
                name="amount"
                type="number"
                min="1"
                step="0.01"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="r-drawer">Lo firmó</Label>
              <SearchSelect
                id="r-drawer"
                name="drawerId"
                options={options}
                required
                placeholder="Librador…"
                searchPlaceholder="Buscar por nombre o curso…"
                emptyMessage="No se encontró ningún alumno."
              />
            </div>
            <div>
              <Label htmlFor="r-payee">A la orden de</Label>
              <SearchSelect
                id="r-payee"
                name="payeeId"
                options={options}
                required
                placeholder="Beneficiario…"
                searchPlaceholder="Buscar por nombre o curso…"
                emptyMessage="No se encontró ningún alumno."
              />
            </div>
          </div>
          <div>
            <Label htmlFor="r-payable">Fecha de pago</Label>
            <Input
              id="r-payable"
              name="payableAt"
              type="date"
              min={today}
              defaultValue={today}
            />
          </div>
          <Feedback state={state} />
          <div className="flex items-center gap-2">
            <SubmitBtn label="Dar de alta" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-ink/50 hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

function DeskChequeCard({
  c,
  feePct,
  bankName,
  actionable = false,
}: {
  c: DeskChequeView;
  feePct: number;
  bankName: string;
  actionable?: boolean;
}) {
  const fee = chequeFee(c.amount, feePct);
  const net = chequeNetAmount(c.amount, feePct);
  const sinFondos = c.drawerBalance < c.amount;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{formatMoney(c.amount)}</p>
          <p className="truncate text-xs text-ink/45">
            Nº {formatChequeNumber(c.number)} · {c.drawerName}
            {c.drawerGroup ? ` (${c.drawerGroup})` : ""} → {c.payeeName}
          </p>
          {c.concept && (
            <p className="mt-1 truncate text-xs text-ink/40">{c.concept}</p>
          )}
        </div>
        <Badge tone={CHEQUE_STATUS_TONES[c.status] ?? "neutral"}>
          {CHEQUE_STATUS_LABELS[c.status] ?? c.status}
        </Badge>
      </div>

      {c.status === "ISSUED" && (
        <div className="mt-3 rounded-xl border border-raised bg-raised/25 p-3 text-xs">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-ink/55">
              Saldo del librador:{" "}
              <span
                className={
                  sinFondos ? "font-semibold text-danger" : "font-semibold"
                }
              >
                {formatMoney(c.drawerBalance)}
              </span>
            </span>
            {feePct > 0 && (
              <span className="text-ink/55">
                Comisión: <span className="font-semibold">{formatMoney(fee)}</span>
              </span>
            )}
            <span className="text-ink/55">
              Se lleva:{" "}
              <span className="font-semibold text-accent">
                {formatMoney(net)}
              </span>
            </span>
          </div>
          {c.drawerBounced > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-danger">
              <ShieldAlert className="h-3.5 w-3.5" />
              {c.drawerBounced}{" "}
              {c.drawerBounced === 1
                ? "cheque rechazado antes"
                : "cheques rechazados antes"}
            </p>
          )}
          {sinFondos && (
            <p className="mt-2 text-danger">
              No tiene fondos: si lo hacés efectivo, va a rebotar y quedar
              registrado.
            </p>
          )}
          {c.daysToPayable > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-warning">
              <CalendarClock className="h-3.5 w-3.5" />
              Diferido al {formatDate(c.payableAt)} · faltan {c.daysToPayable}{" "}
              {c.daysToPayable === 1 ? "día" : "días"}
            </p>
          )}
        </div>
      )}

      {c.status === "PAID" && (
        <p className="mt-3 border-t border-raised pt-2.5 text-xs text-ink/50">
          Pagado en {c.bankName ?? bankName}
          {c.fee ? ` · comisión ${formatMoney(c.fee)}` : ""}
        </p>
      )}
      {c.status === "BOUNCED" && (
        <p className="mt-3 border-t border-raised pt-2.5 text-xs text-danger">
          Rechazado{c.bounceReason ? `: ${c.bounceReason}` : ""}
        </p>
      )}

      {actionable && c.status === "ISSUED" && <DeskActions chequeId={c.id} />}
    </Card>
  );
}

function DeskActions({ chequeId }: { chequeId: string }) {
  const [payState, payAction] = useActionState<ActionResult | null, FormData>(
    cashCheque,
    null,
  );
  const [rejState, rejAction] = useActionState<ActionResult | null, FormData>(
    rejectCheque,
    null,
  );
  const [rejecting, setRejecting] = useState(false);

  return (
    <div className="mt-3 border-t border-raised pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <form action={payAction}>
          <input type="hidden" name="chequeId" value={chequeId} />
          <SubmitBtn label="Hacer efectivo" />
        </form>
        {!rejecting && (
          <button
            type="button"
            onClick={() => setRejecting(true)}
            className="text-xs text-ink/45 transition-colors hover:text-danger"
          >
            Rechazar
          </button>
        )}
      </div>

      {rejecting && (
        <form action={rejAction} className="mt-3 flex items-end gap-2">
          <input type="hidden" name="chequeId" value={chequeId} />
          <div className="flex-1">
            <Label htmlFor={`rej-${chequeId}`}>Motivo</Label>
            <Input
              id={`rej-${chequeId}`}
              name="reason"
              placeholder="La firma no coincide..."
              maxLength={200}
            />
          </div>
          <SubmitBtn label="Rechazar" variant="danger" />
        </form>
      )}

      <Feedback state={payState} />
      <Feedback state={rejState} />
    </div>
  );
}
