-- CreateEnum
CREATE TYPE "CardApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CardBrand" AS ENUM ('VISA', 'MASTERCARD', 'COLEPAY');

-- CreateEnum
CREATE TYPE "CardChargeKind" AS ENUM ('PURCHASE', 'INTEREST', 'FEE');

-- CreateEnum
CREATE TYPE "StatementStatus" AS ENUM ('CLOSED', 'PAID', 'OVERDUE', 'ROLLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'BANK_ADMIN';
ALTER TYPE "Role" ADD VALUE 'BANK_EMPLOYEE';
ALTER TYPE "Role" ADD VALUE 'BANK';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'CARD_PURCHASE';
ALTER TYPE "TransactionType" ADD VALUE 'CARD_PAYMENT';
ALTER TYPE "TransactionType" ADD VALUE 'BANK_FUNDING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CARD_APPLICATION';
ALTER TYPE "NotificationType" ADD VALUE 'CARD_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'CARD_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'CARD_PURCHASE';
ALTER TYPE "NotificationType" ADD VALUE 'STATEMENT_CLOSED';
ALTER TYPE "NotificationType" ADD VALUE 'STATEMENT_DUE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bankId" TEXT;

-- CreateTable
CREATE TABLE "Bank" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#4f46e5',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultLimit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "monthlyRatePct" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "closingDay" INTEGER NOT NULL DEFAULT 25,
    "dueDays" INTEGER NOT NULL DEFAULT 10,
    "accountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardApplication" (
    "id" TEXT NOT NULL,
    "status" "CardApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "requestedLimit" DECIMAL(14,2) NOT NULL,
    "monthlyIncome" DECIMAL(14,2),
    "purpose" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "applicantId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "reviewedById" TEXT,

    CONSTRAINT "CardApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCard" (
    "id" TEXT NOT NULL,
    "brand" "CardBrand" NOT NULL DEFAULT 'VISA',
    "number" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "cvv" TEXT NOT NULL,
    "creditLimit" DECIMAL(14,2) NOT NULL,
    "status" "CardStatus" NOT NULL DEFAULT 'ACTIVE',
    "closingDay" INTEGER NOT NULL,
    "dueDays" INTEGER NOT NULL,
    "monthlyRatePct" DECIMAL(6,2) NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastClosedAt" TIMESTAMP(3),
    "ownerId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "issuedById" TEXT,
    "applicationId" TEXT,

    CONSTRAINT "CreditCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardCharge" (
    "id" TEXT NOT NULL,
    "kind" "CardChargeKind" NOT NULL DEFAULT 'PURCHASE',
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cardId" TEXT NOT NULL,
    "merchantId" TEXT,
    "transactionId" TEXT,
    "statementId" TEXT,

    CONSTRAINT "CardCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardStatement" (
    "id" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "StatementStatus" NOT NULL DEFAULT 'CLOSED',
    "previousBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "chargesTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "interest" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "cardId" TEXT NOT NULL,

    CONSTRAINT "CardStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPayment" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cardId" TEXT NOT NULL,
    "statementId" TEXT,
    "transactionId" TEXT,

    CONSTRAINT "CardPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bank_name_key" ON "Bank"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Bank_slug_key" ON "Bank"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Bank_accountId_key" ON "Bank"("accountId");

-- CreateIndex
CREATE INDEX "Bank_active_idx" ON "Bank"("active");

-- CreateIndex
CREATE INDEX "CardApplication_bankId_status_idx" ON "CardApplication"("bankId", "status");

-- CreateIndex
CREATE INDEX "CardApplication_applicantId_idx" ON "CardApplication"("applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditCard_number_key" ON "CreditCard"("number");

-- CreateIndex
CREATE UNIQUE INDEX "CreditCard_applicationId_key" ON "CreditCard"("applicationId");

-- CreateIndex
CREATE INDEX "CreditCard_ownerId_idx" ON "CreditCard"("ownerId");

-- CreateIndex
CREATE INDEX "CreditCard_bankId_status_idx" ON "CreditCard"("bankId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CardCharge_transactionId_key" ON "CardCharge"("transactionId");

-- CreateIndex
CREATE INDEX "CardCharge_cardId_statementId_idx" ON "CardCharge"("cardId", "statementId");

-- CreateIndex
CREATE INDEX "CardStatement_cardId_status_idx" ON "CardStatement"("cardId", "status");

-- CreateIndex
CREATE INDEX "CardStatement_dueDate_idx" ON "CardStatement"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "CardPayment_transactionId_key" ON "CardPayment"("transactionId");

-- CreateIndex
CREATE INDEX "CardPayment_cardId_idx" ON "CardPayment"("cardId");

-- CreateIndex
CREATE INDEX "User_bankId_idx" ON "User"("bankId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bank" ADD CONSTRAINT "Bank_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardApplication" ADD CONSTRAINT "CardApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardApplication" ADD CONSTRAINT "CardApplication_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardApplication" ADD CONSTRAINT "CardApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CardApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardCharge" ADD CONSTRAINT "CardCharge_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardCharge" ADD CONSTRAINT "CardCharge_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardCharge" ADD CONSTRAINT "CardCharge_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardCharge" ADD CONSTRAINT "CardCharge_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CardStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardStatement" ADD CONSTRAINT "CardStatement_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPayment" ADD CONSTRAINT "CardPayment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPayment" ADD CONSTRAINT "CardPayment_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "CardStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPayment" ADD CONSTRAINT "CardPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

