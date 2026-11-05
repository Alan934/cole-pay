-- Número de comprobante corto: 4 caracteres que los chicos pueden anotar a
-- mano, en lugar del id interno de 25.

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "receiptCode" TEXT;

-- CreateIndex
-- Va antes de completar los movimientos viejos: el generador consulta si el
-- código ya existe y sin índice esa búsqueda recorre toda la tabla.
CREATE UNIQUE INDEX "Transaction_receiptCode_key" ON "Transaction"("receiptCode");

-- Genera un código libre. El alfabeto no trae 0/O ni 1/I porque escritos a
-- mano se confunden: quedan 32 símbolos, 32^4 = 1.048.576 códigos. Si alguna
-- vez cuesta encontrar uno libre, pasa a 5 caracteres en vez de colgarse.
CREATE FUNCTION gen_receipt_code() RETURNS TEXT AS $$
DECLARE
  alphabet CONSTANT TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  len INT := 4;
  tries INT := 0;
  code TEXT;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..len LOOP
      code := code || substr(alphabet, 1 + floor(random() * 32)::INT, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM "Transaction" WHERE "receiptCode" = code
    );
    tries := tries + 1;
    IF tries % 20 = 0 THEN
      len := len + 1;
    END IF;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Los movimientos que ya existen reciben su código de a uno, para que cada
-- búsqueda vea los que se asignaron antes.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM "Transaction" WHERE "receiptCode" IS NULL LOOP
    UPDATE "Transaction" SET "receiptCode" = gen_receipt_code() WHERE id = r.id;
  END LOOP;
END;
$$;

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "receiptCode" SET NOT NULL;
ALTER TABLE "Transaction" ALTER COLUMN "receiptCode" SET DEFAULT gen_receipt_code();
