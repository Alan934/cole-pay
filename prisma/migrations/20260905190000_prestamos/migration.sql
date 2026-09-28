-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'REJECTED', 'CANCELLED', 'ACTIVE', 'PAID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'LOAN_APPLICATION';
ALTER TYPE "NotificationType" ADD VALUE 'LOAN_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'LOAN_REJECTED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'LOAN_DISBURSEMENT';
ALTER TYPE "TransactionType" ADD VALUE 'LOAN_PAYMENT';

-- AlterTable
ALTER TABLE "Bank" ADD COLUMN     "loanRatePct" DECIMAL(6,2) NOT NULL DEFAULT 0,
ADD COLUMN     "maxLoanAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAmount" DECIMAL(14,2) NOT NULL,
    "requestedInstallments" INTEGER NOT NULL DEFAULT 3,
    "monthlyIncome" DECIMAL(14,2),
    "purpose" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "principal" DECIMAL(14,2),
    "monthlyRatePct" DECIMAL(6,2),
    "installments" INTEGER,
    "installmentAmount" DECIMAL(14,2),
    "totalToRepay" DECIMAL(14,2),
    "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "disbursedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "borrowerId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "reviewedById" TEXT,
    "transactionId" TEXT,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanPayment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loanId" TEXT NOT NULL,
    "transactionId" TEXT,

    CONSTRAINT "LoanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Loan_transactionId_key" ON "Loan"("transactionId");

-- CreateIndex
CREATE INDEX "Loan_bankId_status_idx" ON "Loan"("bankId", "status");

-- CreateIndex
CREATE INDEX "Loan_borrowerId_idx" ON "Loan"("borrowerId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanPayment_transactionId_key" ON "LoanPayment"("transactionId");

-- CreateIndex
CREATE INDEX "LoanPayment_loanId_idx" ON "LoanPayment"("loanId");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

