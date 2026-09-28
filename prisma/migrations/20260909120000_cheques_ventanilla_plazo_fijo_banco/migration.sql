-- CreateEnum
CREATE TYPE "ChequeStatus" AS ENUM ('ISSUED', 'PAID', 'BOUNCED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CashOperationKind" AS ENUM ('DEPOSIT', 'WITHDRAWAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'CASH_DEPOSIT';
ALTER TYPE "TransactionType" ADD VALUE 'CASH_WITHDRAWAL';
ALTER TYPE "TransactionType" ADD VALUE 'CHEQUE_PAYMENT';
ALTER TYPE "TransactionType" ADD VALUE 'FIXED_DEPOSIT_OPEN';
ALTER TYPE "TransactionType" ADD VALUE 'FIXED_DEPOSIT_PAYOUT';

-- DropIndex
DROP INDEX "DepositTerm_days_key";

-- AlterTable
ALTER TABLE "Bank" ADD COLUMN     "chequeFeePct" DECIMAL(6,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "DepositTerm" ADD COLUMN     "bankId" TEXT;

-- AlterTable
ALTER TABLE "FixedDeposit" ADD COLUMN     "bankId" TEXT,
ADD COLUMN     "openTransactionId" TEXT,
ADD COLUMN     "payoutTransactionId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "bankId" TEXT;

-- CreateTable
CREATE TABLE "Cheque" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "ChequeStatus" NOT NULL DEFAULT 'ISSUED',
    "concept" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payableAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "bounceReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "fee" DECIMAL(14,2),
    "drawerId" TEXT NOT NULL,
    "payeeId" TEXT NOT NULL,
    "registeredById" TEXT,
    "bankId" TEXT,
    "paidById" TEXT,
    "transactionId" TEXT,

    CONSTRAINT "Cheque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashOperation" (
    "id" TEXT NOT NULL,
    "kind" "CashOperationKind" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bankId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tellerId" TEXT,
    "transactionId" TEXT,

    CONSTRAINT "CashOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cheque_number_key" ON "Cheque"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Cheque_transactionId_key" ON "Cheque"("transactionId");

-- CreateIndex
CREATE INDEX "Cheque_drawerId_status_idx" ON "Cheque"("drawerId", "status");

-- CreateIndex
CREATE INDEX "Cheque_payeeId_status_idx" ON "Cheque"("payeeId", "status");

-- CreateIndex
CREATE INDEX "Cheque_bankId_idx" ON "Cheque"("bankId");

-- CreateIndex
CREATE INDEX "Cheque_status_payableAt_idx" ON "Cheque"("status", "payableAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashOperation_transactionId_key" ON "CashOperation"("transactionId");

-- CreateIndex
CREATE INDEX "CashOperation_bankId_createdAt_idx" ON "CashOperation"("bankId", "createdAt");

-- CreateIndex
CREATE INDEX "CashOperation_customerId_idx" ON "CashOperation"("customerId");

-- CreateIndex
CREATE INDEX "DepositTerm_bankId_active_idx" ON "DepositTerm"("bankId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "DepositTerm_bankId_days_key" ON "DepositTerm"("bankId", "days");

-- CreateIndex
CREATE UNIQUE INDEX "FixedDeposit_openTransactionId_key" ON "FixedDeposit"("openTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedDeposit_payoutTransactionId_key" ON "FixedDeposit"("payoutTransactionId");

-- CreateIndex
CREATE INDEX "FixedDeposit_bankId_status_idx" ON "FixedDeposit"("bankId", "status");

-- CreateIndex
CREATE INDEX "Transaction_bankId_idx" ON "Transaction"("bankId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedDeposit" ADD CONSTRAINT "FixedDeposit_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedDeposit" ADD CONSTRAINT "FixedDeposit_openTransactionId_fkey" FOREIGN KEY ("openTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedDeposit" ADD CONSTRAINT "FixedDeposit_payoutTransactionId_fkey" FOREIGN KEY ("payoutTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositTerm" ADD CONSTRAINT "DepositTerm_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_drawerId_fkey" FOREIGN KEY ("drawerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheque" ADD CONSTRAINT "Cheque_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashOperation" ADD CONSTRAINT "CashOperation_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashOperation" ADD CONSTRAINT "CashOperation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashOperation" ADD CONSTRAINT "CashOperation_tellerId_fkey" FOREIGN KEY ("tellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashOperation" ADD CONSTRAINT "CashOperation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

