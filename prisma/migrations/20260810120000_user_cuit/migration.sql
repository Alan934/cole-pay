-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cuit" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_cuit_key" ON "User"("cuit");
