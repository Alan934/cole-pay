-- Adhesión de los alumnos de tercero a los bancos.

-- CreateTable
CREATE TABLE "BankMembership" (
    "id" TEXT NOT NULL,
    "adheredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "note" TEXT,
    "studentId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "registeredById" TEXT,

    CONSTRAINT "BankMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankMembership_studentId_bankId_key" ON "BankMembership"("studentId", "bankId");

-- CreateIndex
CREATE INDEX "BankMembership_bankId_endedAt_idx" ON "BankMembership"("bankId", "endedAt");

-- CreateIndex
CREATE INDEX "BankMembership_studentId_endedAt_idx" ON "BankMembership"("studentId", "endedAt");

-- AddForeignKey
ALTER TABLE "BankMembership" ADD CONSTRAINT "BankMembership_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankMembership" ADD CONSTRAINT "BankMembership_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankMembership" ADD CONSTRAINT "BankMembership_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Los alumnos que ya operan con un banco (tarjeta, préstamo, plazo fijo,
-- ventanilla, cheque cobrado o solicitud en curso) quedan adheridos a él desde
-- su primera operación, para que no pierdan acceso a lo que ya tenían.
INSERT INTO "BankMembership" ("id", "adheredAt", "note", "studentId", "bankId")
SELECT
    'mb_' || md5(op."studentId" || ':' || op."bankId"),
    MIN(op."at"),
    'Adhesión generada automáticamente a partir de operaciones previas.',
    op."studentId",
    op."bankId"
FROM (
    SELECT "ownerId" AS "studentId", "bankId", "issuedAt" AS "at" FROM "CreditCard"
    UNION ALL
    SELECT "applicantId", "bankId", "createdAt" FROM "CardApplication" WHERE "status" = 'PENDING'
    UNION ALL
    SELECT "borrowerId", "bankId", "createdAt" FROM "Loan" WHERE "status" IN ('PENDING', 'ACTIVE', 'PAID')
    UNION ALL
    SELECT "userId", "bankId", "createdAt" FROM "FixedDeposit" WHERE "bankId" IS NOT NULL
    UNION ALL
    SELECT "customerId", "bankId", "createdAt" FROM "CashOperation"
    UNION ALL
    SELECT "payeeId", "bankId", "paidAt" FROM "Cheque" WHERE "status" = 'PAID' AND "bankId" IS NOT NULL AND "paidAt" IS NOT NULL
) op
JOIN "User" u ON u."id" = op."studentId" AND u."role" = 'STUDENT'
GROUP BY op."studentId", op."bankId";
