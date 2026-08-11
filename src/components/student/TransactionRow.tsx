import {
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  Receipt,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { formatMoney, formatDate, formatDateLong, cn } from "@/lib/utils";
import { DAYS_IN_YEAR } from "@/lib/interest";
import { TX_TYPE_LABELS } from "@/lib/tx";
import type { TaxId } from "@/lib/identity";

export type TxView = {
  id: string;
  type: string;
  amount: number;
  description: string;
  category?: string | null;
  timestamp: string;
  incoming: boolean;
  counterparty: string;
  /** CUIT de la otra parte o, si no tiene cargado, su DNI. */
  counterpartyTaxId?: TaxId | null;
  counterpartyAlias?: string | null;
  counterpartyCvu?: string | null;
  /** Presente sólo en intereses: permite mostrar cómo se calculó. */
  accrual?: {
    base: number;
    tnaPct: number;
    days: number;
    formula: string;
  } | null;
};

export function TransactionRow({ tx }: { tx: TxView }) {
  const { icon: Icon, tone } = iconFor(tx.type, tx.incoming);

  return (
    <details className="group py-1">
      <summary className="flex cursor-pointer list-none items-center gap-3 py-2">
        <div
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full",
            tone,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink/90">
            {tx.description}
          </p>
          <p className="truncate text-xs text-ink/40">
            {tx.counterparty} · {formatDate(tx.timestamp)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 text-sm font-semibold",
            tx.incoming ? "text-accent" : "text-ink/80",
          )}
        >
          {tx.incoming ? "+" : "−"}
          {formatMoney(tx.amount)}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink/30 transition-transform group-open:rotate-180" />
      </summary>

      <div className="mb-2 ml-[52px] flex flex-col gap-3 rounded-xl border border-raised bg-raised/30 p-3">
        <dl className="flex flex-col gap-1.5 text-xs">
          <Detail label={tx.incoming ? "Recibiste de" : "Enviaste a"}>
            {tx.counterparty}
          </Detail>
          {tx.counterpartyTaxId && (
            <Detail label={tx.counterpartyTaxId.label} mono>
              {tx.counterpartyTaxId.value}
            </Detail>
          )}
          {tx.counterpartyAlias && (
            <Detail label="Alias" mono>
              {tx.counterpartyAlias}
            </Detail>
          )}
          {tx.counterpartyCvu && (
            <Detail label="CVU" mono>
              {tx.counterpartyCvu}
            </Detail>
          )}
          <Detail label="Fecha y hora">{formatDateLong(tx.timestamp)}</Detail>
          <Detail label="Tipo">{TX_TYPE_LABELS[tx.type] ?? tx.type}</Detail>
          {tx.category && <Detail label="Categoría">{tx.category}</Detail>}
          <Detail label="Monto">
            {tx.incoming ? "+" : "−"}
            {formatMoney(tx.amount)}
          </Detail>
          <Detail label="Comprobante" mono>
            {tx.id}
          </Detail>
        </dl>

        {/* En los intereses, además, la cuenta que los generó. */}
        {tx.accrual && (
          <div className="border-t border-raised pt-2.5">
            <p className="mb-1.5 text-xs font-medium text-ink/60">
              Cómo se calculó
            </p>
            <p className="font-mono text-xs leading-relaxed text-ink/70">
              capital × (TNA ÷ 100) × (días ÷ {DAYS_IN_YEAR})
              <br />
              {tx.accrual.formula}
            </p>
            <p className="mt-2 text-xs text-ink/40">
              Capital: {formatMoney(tx.accrual.base)} · TNA: {tx.accrual.tnaPct}
              % · Días: {tx.accrual.days}
            </p>
          </div>
        )}
      </div>
    </details>
  );
}

function Detail({
  label,
  mono,
  children,
}: {
  label: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-ink/40">{label}</dt>
      <dd
        className={cn(
          "min-w-0 flex-1 break-words text-ink/80",
          mono && "font-mono",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

function iconFor(type: string, incoming: boolean) {
  if (type === "ISSUANCE")
    return { icon: Sparkles, tone: "bg-violet/15 text-violet" };
  if (type === "INTEREST")
    return { icon: TrendingUp, tone: "bg-accent/15 text-accent" };
  if (type === "PAYMENT")
    return { icon: Receipt, tone: "bg-warning/15 text-warning" };
  if (incoming)
    return { icon: ArrowDownLeft, tone: "bg-accent/15 text-accent" };
  return { icon: ArrowUpRight, tone: "bg-raised2 text-ink/70" };
}
