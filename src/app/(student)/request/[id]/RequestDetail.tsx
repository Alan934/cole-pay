"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, FileText, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Qr } from "@/components/Qr";
import { AutoRefresh } from "@/components/AutoRefresh";
import { formatMoney } from "@/lib/utils";
import {
  CancelRequest,
  payLink,
  type RequestView,
} from "../RequestManager";

/**
 * Pantalla de un cobro con QR: se muestra grande para que lo escaneen y se
 * actualiza sola, así quien cobra ve en el momento que le pagaron.
 */
export function RequestDetail({
  origin,
  alias,
  r,
}: {
  origin: string;
  alias: string;
  r: RequestView;
}) {
  const pending = r.status === "PENDING";

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <AutoRefresh active={pending} />

      {r.status === "PAID" ? (
        <PaidView r={r} />
      ) : r.status === "CANCELLED" ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-lg font-semibold">Cobro cancelado</p>
          <p className="text-sm text-ink/50">
            Este QR dejó de funcionar. Si necesitás cobrar, creá uno nuevo.
          </p>
        </Card>
      ) : (
        <PendingView origin={origin} alias={alias} r={r} />
      )}

      <Link
        href="/request"
        className="flex items-center justify-center gap-2 text-sm text-ink/60 hover:text-ink"
      >
        <ListChecks className="h-4 w-4" />
        Ver todos mis cobros
      </Link>
    </div>
  );
}

function PendingView({
  origin,
  alias,
  r,
}: {
  origin: string;
  alias: string;
  r: RequestView;
}) {
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
    <Card className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-ink/50">Mostrá este QR para cobrar</p>
      <p className="text-4xl font-bold tracking-tight">{formatMoney(r.amount)}</p>
      {r.description && <p className="text-sm text-ink/60">{r.description}</p>}

      <Qr value={link} size={240} className="bg-white p-2" />

      <p
        role="status"
        className="flex items-center gap-2 text-sm text-ink/60"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning/70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-warning" />
        </span>
        Esperando el pago…
      </p>

      <div className="flex w-full flex-wrap items-center gap-2 border-t border-raised pt-3">
        <Button size="sm" variant="ghost" onClick={copy}>
          {copied ? (
            <Check className="h-4 w-4 text-accent" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? "Copiado" : "Copiar link"}
        </Button>
        <CancelRequest r={r} />
      </div>
    </Card>
  );
}

function PaidView({ r }: { r: RequestView }) {
  return (
    <Card className="flex flex-col items-center gap-4 py-10 text-center animate-fade-in">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-accent/15 animate-pop-in">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-accent text-onaccent">
          <Check className="h-8 w-8" strokeWidth={3} />
        </div>
      </div>
      <div>
        <p className="text-lg font-semibold">¡Te pagaron!</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">
          {formatMoney(r.amount)}
        </p>
        {r.payerName && (
          <p className="mt-1 text-sm text-ink/60">Pagado por {r.payerName}</p>
        )}
        {r.description && (
          <p className="text-sm text-ink/50">{r.description}</p>
        )}
      </div>
      {r.transactionId && (
        <Link href={`/receipt/${r.transactionId}`} className="w-full">
          <Button size="lg" className="w-full">
            <FileText className="h-5 w-5" />
            Ver comprobante
          </Button>
        </Link>
      )}
    </Card>
  );
}
