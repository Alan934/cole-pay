-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dni" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_dni_key" ON "User"("dni");
