import type { Prisma } from "@prisma/client";

/** Texto que identifica a un pago hecho escaneando un QR de cobro. */
export const QR_LABEL = "Cobro por QR";

/** Traduce los errores de `settlePaymentRequest` a un mensaje para el alumno. */
export function requestErrorMessage(code: string): string | null {
  if (code === "PEDIDO_NO_DISPONIBLE")
    return "Este cobro ya fue pagado o cancelado. Pedile un QR nuevo a quien te cobra.";
  if (code === "PEDIDO_MONTO")
    return "El monto no coincide con el del cobro. Escaneá el QR de nuevo.";
  return null;
}

/**
 * Salda un pedido de cobro dentro de la transacción del pago. Falla (y por lo
 * tanto el pago entero se revierte) si el pedido no es de quien cobra, ya no
 * está pendiente o el monto no es el pedido.
 *
 * El cambio de estado es condicional (`PENDING` -> `PAID`), así que si dos
 * alumnos pagan el mismo QR a la vez, sólo uno lo logra.
 */
export async function settlePaymentRequest(
  tx: Prisma.TransactionClient,
  opts: {
    requestId: string;
    requesterId: string;
    payerId: string;
    amount: Prisma.Decimal;
    transactionId: string;
  },
) {
  const req = await tx.paymentRequest.findUnique({
    where: { id: opts.requestId },
  });
  if (!req || req.requesterId !== opts.requesterId)
    throw new Error("PEDIDO_NO_DISPONIBLE");
  if (!req.amount.equals(opts.amount)) throw new Error("PEDIDO_MONTO");

  const done = await tx.paymentRequest.updateMany({
    where: { id: opts.requestId, status: "PENDING" },
    data: {
      status: "PAID",
      paidAt: new Date(),
      payerId: opts.payerId,
      transactionId: opts.transactionId,
    },
  });
  if (done.count !== 1) throw new Error("PEDIDO_NO_DISPONIBLE");
}
