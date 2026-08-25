"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, Check, Send, User, X } from "lucide-react";
import {
  lookupDestination,
  transferMoney,
  type ActionResult,
  type DestinationLookup,
} from "@/app/actions/student";
import { Card } from "@/components/ui/Card";
import { Input, Label, Textarea, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/utils";
import { SPENDING_CATEGORIES } from "@/lib/validations";

/** Destinatario ya verificado + los datos del formulario listos para enviar. */
type PendingTransfer = {
  data: FormData;
  dest: Extract<DestinationLookup, { ok: true }>;
  amount: number;
  description: string;
  category: string;
};

export function TransferForm({
  balance,
  prefill,
}: {
  balance: number;
  prefill?: { to?: string; amount?: string; desc?: string; req?: string };
}) {
  const [state, formAction, isPending] = useActionState<
    ActionResult | null,
    FormData
  >(transferMoney, null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [pendingTransfer, setPendingTransfer] =
    useState<PendingTransfer | null>(null);
  const [checking, setChecking] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (state?.ok) {
      setPendingTransfer(null);
      setShowSuccess(true);
      const t = setTimeout(() => setShowSuccess(false), 3500);
      return () => clearTimeout(t);
    }
    // Si el servidor rechazó la transferencia (por ejemplo, saldo insuficiente),
    // cerramos el cartel y mostramos el error sobre el formulario.
    if (state && !state.ok) setPendingTransfer(null);
  }, [state]);

  /** Paso 1: buscar al destinatario y pedir confirmación antes de enviar. */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (checking || isPending) return;

    const data = new FormData(e.currentTarget);
    const amount = Number(data.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) {
      setLocalError("El monto debe ser mayor a 0");
      return;
    }
    if (amount > balance) {
      setLocalError("Saldo insuficiente para esta transferencia.");
      return;
    }

    setLocalError(null);
    setChecking(true);
    const dest = await lookupDestination(String(data.get("destination") ?? ""));
    setChecking(false);

    if (!dest.ok) {
      setLocalError(dest.error);
      return;
    }
    setPendingTransfer({
      data,
      dest,
      amount,
      description: String(data.get("description") ?? "").trim(),
      category: String(data.get("category") ?? "General"),
    });
  }

  /** Paso 2: el alumno confirmó, recién ahora se mueve la plata. */
  function confirmTransfer() {
    if (!pendingTransfer) return;
    formAction(pendingTransfer.data);
  }

  if (showSuccess && state?.ok) {
    return (
      <Card className="flex flex-col items-center gap-4 py-12 text-center animate-fade-in">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-accent/15 animate-pop-in">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-accent text-onaccent">
            <Check className="h-8 w-8" strokeWidth={3} />
          </div>
        </div>
        <div>
          <p className="text-lg font-semibold">¡Transferencia exitosa!</p>
          <p className="mt-1 text-sm text-ink/50">{state.message}</p>
        </div>
        <Button variant="secondary" onClick={() => setShowSuccess(false)}>
          Hacer otra transferencia
        </Button>
      </Card>
    );
  }

  const error = localError ?? (state && !state.ok ? state.error : null);

  return (
    <>
      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {prefill?.req && (
            <input type="hidden" name="req" value={prefill.req} />
          )}
          <div>
            <Label htmlFor="destination">CVU o Alias del destinatario</Label>
            <Input
              id="destination"
              name="destination"
              placeholder="ej: sofia.sol.mar"
              autoComplete="off"
              defaultValue={prefill?.to ?? ""}
              required
            />
          </div>

          <div>
            <Label htmlFor="amount">Monto</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40">
                $
              </span>
              <Input
                id="amount"
                name="amount"
                type="number"
                min="1"
                step="0.01"
                placeholder="0,00"
                className="pl-8 text-lg"
                defaultValue={prefill?.amount ?? ""}
                required
              />
            </div>
            <p className="mt-1.5 px-1 text-xs text-ink/40">
              Disponible: {formatMoney(balance)}
            </p>
          </div>

          <div>
            <Label htmlFor="category">Categoría</Label>
            <Select id="category" name="category" defaultValue="General">
              {SPENDING_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Mensaje (opcional)</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              maxLength={120}
              placeholder="¿Para qué es esta transferencia?"
              defaultValue={prefill?.desc ?? ""}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={checking || isPending}
          >
            <Send className="h-5 w-5" />
            {checking ? "Verificando..." : "Continuar"}
          </Button>
        </form>
      </Card>

      {pendingTransfer && (
        <ConfirmDialog
          transfer={pendingTransfer}
          sending={isPending}
          onConfirm={confirmTransfer}
          onCancel={() => setPendingTransfer(null)}
        />
      )}
    </>
  );
}

/** Cartel de confirmación con los datos de quien va a recibir la plata. */
function ConfirmDialog({
  transfer,
  sending,
  onConfirm,
  onCancel,
}: {
  transfer: PendingTransfer;
  sending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { dest, amount, description, category } = transfer;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, sending]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => !sending && onCancel()}
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-transfer-title"
        className="w-full max-w-md animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="confirm-transfer-title" className="text-lg font-bold">
              Confirmá la transferencia
            </h3>
            <p className="mt-0.5 text-sm text-ink/50">
              Revisá que los datos sean correctos. Una vez enviada no se puede
              deshacer.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={sending}
            aria-label="Cancelar"
            className="rounded-lg p-1 text-ink/50 hover:bg-raised2 hover:text-ink disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-raised2/70 bg-raised/50 p-4">
          <p className="text-xs uppercase tracking-wide text-ink/40">
            Le enviás a
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <User className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{dest.name}</p>
              <p className="text-sm text-ink/60">
                {dest.taxId
                  ? `${dest.taxId.label} ${dest.taxId.value}`
                  : "Sin DNI/CUIT registrado"}
              </p>
            </div>
          </div>

          <dl className="mt-4 flex flex-col gap-1.5 border-t border-raised2/70 pt-3 text-sm">
            <Row label="Alias" value={dest.alias} />
            <Row label="CVU" value={dest.cvu} />
            <Row label="Categoría" value={category} />
            {description && <Row label="Mensaje" value={description} />}
          </dl>
        </div>

        <div className="mt-4 flex items-baseline justify-between rounded-xl bg-accent/10 px-4 py-3">
          <span className="text-sm text-ink/60">Monto</span>
          <span className="text-2xl font-bold">{formatMoney(amount)}</span>
        </div>

        <div className="mt-5 flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onCancel}
            disabled={sending}
          >
            Volver
          </Button>
          <Button className="flex-1" onClick={onConfirm} disabled={sending}>
            <Check className="h-4 w-4" />
            {sending ? "Enviando..." : "Confirmar"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink/50">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
