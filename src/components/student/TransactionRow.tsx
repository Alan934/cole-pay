import {
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  Receipt,
} from "lucide-react";
import { formatMoney, formatDate, cn } from "@/lib/utils";

export type TxView = {
  id: string;
  type: string;
  amount: number;
  description: string;
  timestamp: string;
  incoming: boolean;
  counterparty: string;
};

export function TransactionRow({ tx }: { tx: TxView }) {
  const { icon: Icon, tone } = iconFor(tx.type, tx.incoming);
  return (
    <div className="flex items-center gap-3 py-3">
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
    </div>
  );
}

function iconFor(type: string, incoming: boolean) {
  if (type === "ISSUANCE")
    return { icon: Sparkles, tone: "bg-violet/15 text-violet" };
  if (type === "PAYMENT")
    return { icon: Receipt, tone: "bg-amber-500/15 text-amber-300" };
  if (incoming)
    return { icon: ArrowDownLeft, tone: "bg-accent/15 text-accent" };
  return { icon: ArrowUpRight, tone: "bg-raised2 text-ink/70" };
}
