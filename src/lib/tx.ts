import type { TxView } from "@/components/student/TransactionRow";

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
};

/** Convierte una transacción de Prisma en una vista orientada al usuario. */
export function toTxView(tx: TxWithUsers, userId: string): TxView {
  const incoming = tx.receiverId === userId;
  let counterparty: string;
  if (tx.type === "ISSUANCE") counterparty = "Banco Central";
  else if (incoming) counterparty = tx.sender?.name ?? "Sistema";
  else counterparty = tx.receiver?.name ?? "Sistema";

  return {
    id: tx.id,
    type: tx.type,
    amount: Number(tx.amount.toString()),
    description: tx.description,
    timestamp: tx.timestamp.toISOString(),
    incoming,
    counterparty,
  };
}
