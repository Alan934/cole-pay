import type { TxView } from "@/components/student/TransactionRow";
import { breakdown } from "@/lib/interest";
import { taxIdOf } from "@/lib/identity";

/** Nombre legible de cada tipo de movimiento. */
export const TX_TYPE_LABELS: Record<string, string> = {
  TRANSFER: "Transferencia",
  ISSUANCE: "Emisión",
  DEPOSIT: "Carga de saldo",
  PAYMENT: "Pago de cuenta",
  PRIZE: "Premio",
  FINE: "Multa",
  INTEREST: "Interés",
  SAVINGS: "Ahorro",
};

type Party = {
  name: string;
  dni?: string | null;
  cuit?: string | null;
  wallet?: { alias: string; cvu: string } | null;
} | null;

type TxWithUsers = {
  id: string;
  type: string;
  amount: { toString(): string };
  description: string;
  category?: string | null;
  timestamp: Date;
  senderId: string | null;
  receiverId: string | null;
  sender: Party;
  receiver: Party;
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
  const other = incoming ? tx.sender : tx.receiver;

  let counterparty: string;
  if (tx.type === "ISSUANCE") counterparty = "Banco Central";
  else counterparty = other?.name ?? "Sistema";

  const acc = tx.accrual;
  return {
    id: tx.id,
    type: tx.type,
    amount: Number(tx.amount.toString()),
    description: tx.description,
    category: tx.category ?? null,
    timestamp: tx.timestamp.toISOString(),
    incoming,
    counterparty,
    // Identificación de la otra parte para el comprobante: CUIT o, si no
    // tiene, DNI.
    counterpartyTaxId: other ? taxIdOf(other) : null,
    counterpartyAlias: other?.wallet?.alias ?? null,
    counterpartyCvu: other?.wallet?.cvu ?? null,
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
