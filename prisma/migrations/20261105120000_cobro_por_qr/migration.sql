-- Los pagos hechos escaneando un QR de cobro pasan a ser un tipo de movimiento
-- propio (antes quedaban como una transferencia más).

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'QR_PAYMENT';

-- AlterTable: movimiento con el que se saldó el pedido de cobro.
ALTER TABLE "PaymentRequest" ADD COLUMN "transactionId" TEXT;
