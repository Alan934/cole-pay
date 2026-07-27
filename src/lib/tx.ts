import type { TxView } from "@/components/student/TransactionRow";
import { breakdown } from "@/lib/interest";

type TxWithUsers = {
  id: string;
  type: string;
  amount: { toString(): string };
  description: string;
  timestamp: Date;
  senderId: string | null;
  receiverId: string | null;
  sender: { name: string } | null;
  receiver: { name: string } | null;
  /** Detalle del cálculo, sólo en las transacciones de interés. */
  accrual?: {
    base: { toString(): string };
    tnaPct: { toString(): string };
    days: number;
  } | null;
};

/** Convierte una transacción de Prisma en una vista orientada al usuario. */
export function toTxView(tx: TxWithUsers, userId: string): TxView {
  const incoming = tx.receiverId === userId;
  let counterparty: string;
  if (tx.type === "ISSUANCE") counterparty = "Banco Central";
  else if (incoming) counterparty = tx.sender?.name ?? "Sistema";
  else counterparty = tx.receiver?.name ?? "Sistema";

  const acc = tx.accrual;
  return {
    id: tx.id,
    type: tx.type,
    amount: Number(tx.amount.toString()),
    description: tx.description,
    timestamp: tx.timestamp.toISOString(),
    incoming,
    counterparty,
    accrual: acc
      ? {
          base: Number(acc.base.toString()),
          tnaPct: Number(acc.tnaPct.toString()),
          days: acc.days,
          formula: breakdown(
            Number(acc.base.toString()),
            Number(acc.tnaPct.toString()),
            acc.days,
          ).formula,
        }
      : null,
  };
}
