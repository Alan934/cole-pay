-- CreateEnum
CREATE TYPE "AccrualSource" AS ENUM ('BALANCE', 'GOAL');

-- AlterEnum
ALTER TYPE "DepositStatus" ADD VALUE 'BROKEN';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'INTEREST_PAID';

-- AlterTable
ALTER TABLE "FixedDeposit" ADD COLUMN     "termDays" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "SavingsGoal" ADD COLUMN     "earnedInterest" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "lastAccrualAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "lastAccrualAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BankSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "interestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "balanceTnaPct" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "goalsTnaPct" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "goalsLockDays" INTEGER NOT NULL DEFAULT 0,
    "minBalanceToEarn" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lastAccrualAt" TIMESTAMP(3),
    "inflationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "monthlyInflationPct" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "priceIndex" DECIMAL(14,4) NOT NULL DEFAULT 100,
    "lastInflationAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositTerm" (
    "id" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "tnaPct" DECIMAL(6,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "settingsId" TEXT NOT NULL DEFAULT 'singleton',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterestRun" (
    "id" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "days" INTEGER NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "balanceTnaPct" DECIMAL(6,2) NOT NULL,
    "goalsTnaPct" DECIMAL(6,2) NOT NULL,
    "totalPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "walletsCount" INTEGER NOT NULL DEFAULT 0,
    "trigger" TEXT NOT NULL DEFAULT 'CRON',

    CONSTRAINT "InterestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterestAccrual" (
    "id" TEXT NOT NULL,
    "source" "AccrualSource" NOT NULL,
    "base" DECIMAL(14,2) NOT NULL,
    "tnaPct" DECIMAL(6,2) NOT NULL,
    "days" INTEGER NOT NULL,
    "interest" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "runId" TEXT,
    "transactionId" TEXT,

    CONSTRAINT "InterestAccrual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepositTerm_days_key" ON "DepositTerm"("days");

-- CreateIndex
CREATE INDEX "DepositTerm_active_idx" ON "DepositTerm"("active");

-- CreateIndex
CREATE INDEX "InterestRun_runAt_idx" ON "InterestRun"("runAt");

-- CreateIndex
CREATE UNIQUE INDEX "InterestAccrual_transactionId_key" ON "InterestAccrual"("transactionId");

-- CreateIndex
CREATE INDEX "InterestAccrual_userId_idx" ON "InterestAccrual"("userId");

-- CreateIndex
CREATE INDEX "InterestAccrual_runId_idx" ON "InterestAccrual"("runId");

-- CreateIndex
CREATE INDEX "QuizAttempt_userId_questionId_idx" ON "QuizAttempt"("userId", "questionId");

-- AddForeignKey
ALTER TABLE "DepositTerm" ADD CONSTRAINT "DepositTerm_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "BankSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterestAccrual" ADD CONSTRAINT "InterestAccrual_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterestAccrual" ADD CONSTRAINT "InterestAccrual_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InterestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterestAccrual" ADD CONSTRAINT "InterestAccrual_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Datos iniciales y conversión de los plazos fijos existentes.
-- ---------------------------------------------------------------------------

-- Fila única de configuración (los valores por defecto dejan todo apagado).
INSERT INTO "BankSettings" ("id", "updatedAt")
VALUES ('singleton', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Plazos ofrecidos por el banco, expresados en TNA.
INSERT INTO "DepositTerm" ("id", "days", "tnaPct", "active", "settingsId", "updatedAt")
VALUES
  ('term_7d',  7,  70.00,  true, 'singleton', CURRENT_TIMESTAMP),
  ('term_14d', 14, 85.00,  true, 'singleton', CURRENT_TIMESTAMP),
  ('term_30d', 30, 100.00, true, 'singleton', CURRENT_TIMESTAMP)
ON CONFLICT ("days") DO NOTHING;

-- Los plazos fijos viejos guardaban la tasa DEL PERÍODO (7d=2%, 14d=5%, 30d=12%).
-- Ahora ratePct es una TNA anual, así que hay que convertirla.
-- Primero se deduce el plazo real a partir de las fechas.
UPDATE "FixedDeposit"
SET "termDays" = GREATEST(1, ROUND(EXTRACT(EPOCH FROM ("maturesAt" - "createdAt")) / 86400)::int);

-- TNA equivalente = tasaDelPeríodo × 365 / días. Así el pago final no cambia.
UPDATE "FixedDeposit"
SET "ratePct" = ROUND("ratePct" * 365.0 / "termDays", 2);
