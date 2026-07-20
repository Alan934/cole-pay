"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { QrCode, Copy, Check, X, HandCoins } from "lucide-react";
import {
  createPaymentRequest,
  cancelPaymentRequest,
} from "@/app/actions/features";
import type { ActionResult } from "@/app/actions/student";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Qr } from "@/components/Qr";
import { formatMoney } from "@/lib/utils";

export type RequestView = {
  id: string;
  amount: number;
  description: string | null;
  status: string;
  payerName: string | null;
};

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "..." : label}
    </Button>
  );
}

function payLink(
  origin: string,
  alias: string,
  amount: number,
  desc?: string | null,
  reqId?: string,
) {
  const params = new URLSearchParams({ to: alias, amount: String(amount) });
  if (desc) params.set("desc", desc);
  if (reqId) params.set("req", reqId);
  return `${origin}/transfer?${params.toString()}`;
}

export function RequestManager({
  origin,
  alias,
  requests,
}: {
  origin: string;
  alias: string;
  requests: RequestView[];
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Mi QR para recibir (sin monto) */}
      <Card className="flex flex-col items-center gap-3 text-center">
        <CardTitle>Mi QR para recibir</CardTitle>
        <Qr value={payLink(origin, alias, 0)} size={180} className="bg-white p-2" />
        <p className="text-sm text-ink/60">
          Mostralo para que te transfieran a{" "}
          <span className="font-medium text-accent">{alias}</span>
        </p>
      </Card>

      <CreateRequest />

      <section className="flex flex-col gap-3">
        <CardTitle className="px-1">Mis pedidos de cobro</CardTitle>
        {requests.length === 0 ? (
          <Card className="py-8 text-center text-sm text-ink/40">
            Todavía no creaste pedidos.
          </Card>
        ) : (
          requests.map((r) => (
            <RequestCard key={r.id} r={r} origin={origin} alias={alias} />
          ))
        )}
      </section>
    </div>
  );
}

function CreateRequest() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    createPaymentRequest,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <HandCoins className="h-5 w-5 text-accent" />
        <CardTitle className="text-ink/80">Pedir un monto puntual</CardTitle>
      </div>
      <form ref={ref} action={formAction} className="flex flex-col gap-3">
        <div>
          <Label htmlFor="r-amount">Monto</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40">
              $
            </span>
            <Input
              id="r-amount"
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
          <Label htmlFor="r-desc">¿Por qué? (opcional)</Label>
          <Textarea
            id="r-desc"
            name="description"
            rows={2}
            maxLength={120}
            placeholder="ej: Tu parte del regalo"
          />
        </div>
        {state && (
          <p className={state.ok ? "text-sm text-accent" : "text-sm text-red-300"}>
            {state.ok ? state.message : state.error}
          </p>
        )}
        <div>
          <SubmitBtn label="Crear pedido con QR" />
        </div>
      </form>
    </Card>
  );
}

function RequestCard({
  r,
  origin,
  alias,
}: {
  r: RequestView;
  origin: string;
  alias: string;
}) {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = payLink(origin, alias, r.amount, r.description, r.id);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* no disponible */
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold">{formatMoney(r.amount)}</p>
          {r.description && (
            <p className="text-sm text-ink/60">{r.description}</p>
          )}
          {r.status === "PAID" && r.payerName && (
            <p className="text-xs text-accent">Pagado por {r.payerName}</p>
          )}
        </div>
        {r.status === "PAID" ? (
          <Badge tone="success">Pagado</Badge>
        ) : r.status === "CANCELLED" ? (
          <Badge tone="neutral">Cancelado</Badge>
        ) : (
          <Badge tone="warning">Pendiente</Badge>
        )}
      </div>

      {r.status === "PENDING" && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-raised pt-3">
            <Button size="sm" variant="secondary" onClick={() => setShowQr((s) => !s)}>
              <QrCode className="h-4 w-4" />
              {showQr ? "Ocultar QR" : "Ver QR"}
            </Button>
            <Button size="sm" variant="ghost" onClick={copy}>
              {copied ? (
                <Check className="h-4 w-4 text-accent" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copiado" : "Copiar link"}
            </Button>
            <CancelRequest requestId={r.id} />
          </div>
          {showQr && (
            <div className="mt-3 flex justify-center">
              <Qr value={link} size={190} className="bg-white p-2" />
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function CancelRequest({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    cancelPaymentRequest,
    null,
  );
  useEffect(() => {
    void state;
  }, [state]);
  return (
    <form action={formAction} className="ml-auto">
      <input type="hidden" name="requestId" value={requestId} />
      <button
        type="submit"
        title="Cancelar pedido"
        className="grid h-8 w-8 place-items-center rounded-lg text-ink/40 hover:bg-red-500/15 hover:text-red-300"
      >
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}
