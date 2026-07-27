import {
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  Receipt,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { formatMoney, formatDate, cn } from "@/lib/utils";
import { DAYS_IN_YEAR } from "@/lib/interest";

export type TxView = {
  id: string;
  type: string;
  amount: number;
  description: string;
  timestamp: string;
  incoming: boolean;
  counterparty: string;
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

  const row = (
    <>
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
    </>
  );

  // Los intereses se pueden desplegar para ver la cuenta que los generó.
  if (tx.accrual) {
    return (
      <details className="group py-1">
        <summary className="flex cursor-pointer list-none items-center gap-3 py-2">
          {row}
          <ChevronDown className="h-4 w-4 shrink-0 text-ink/30 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mb-2 ml-[52px] rounded-xl border border-raised bg-raised/30 p-3">
          <p className="mb-1.5 text-xs font-medium text-ink/60">
            Cómo se calculó
          </p>
          <p className="font-mono text-xs leading-relaxed text-ink/70">
            capital × (TNA ÷ 100) × (días ÷ {DAYS_IN_YEAR})
            <br />
            {tx.accrual.formula}
          </p>
          <p className="mt-2 text-xs text-ink/40">
            Capital: {formatMoney(tx.accrual.base)} · TNA: {tx.accrual.tnaPct}%
            · Días: {tx.accrual.days}
          </p>
        </div>
      </details>
    );
  }

  return <div className="flex items-center gap-3 py-3">{row}</div>;
}

function iconFor(type: string, incoming: boolean) {
  if (type === "ISSUANCE")
    return { icon: Sparkles, tone: "bg-violet/15 text-violet" };
  if (type === "INTEREST")
    return { icon: TrendingUp, tone: "bg-accent/15 text-accent" };
  if (type === "PAYMENT")
    return { icon: Receipt, tone: "bg-amber-500/15 text-amber-300" };
  if (incoming)
    return { icon: ArrowDownLeft, tone: "bg-accent/15 text-accent" };
  return { icon: ArrowUpRight, tone: "bg-raised2 text-ink/70" };
}
