/**
 * Crea (o actualiza) el alumno ficticio que usan los chicos en el TP cuando no
 * quieren transferirle a un compañero. Es una cuenta común de ColePay: recibe
 * transferencias y pedidos de cobro como cualquier alumno.
 *
 * Es idempotente: si ya existe, no la duplica y muestra sus datos.
 *
 * Uso:  npx tsx scripts/create-tp-user.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TP_USER = {
  name: "Tomás Ledesma",
  email: "tomas.ledesma@colepay.edu",
  password: "alumno1234",
  dni: "45887310",
  cuit: "20458873101",
  alias: "tomi.ledesma.tp",
  // Sin grupo a propósito: no tiene que recibir los cobros recurrentes del curso.
  groupId: null as string | null,
};

/** CVU ficticio de 22 dígitos. */
function cvu(): string {
  let s = "";
  for (let i = 0; i < 22; i++) s += Math.floor(Math.random() * 10);
  return s;
}

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: TP_USER.email },
    include: { wallet: true },
  });

  if (existing?.wallet) {
    console.log("ℹ️  El alumno del TP ya existía, no se tocó nada.\n");
    print(existing.name, existing.dni, existing.wallet.alias, existing.wallet.cvu);
    return;
  }

  const user = await prisma.user.create({
    data: {
      name: TP_USER.name,
      email: TP_USER.email,
      dni: TP_USER.dni,
      cuit: TP_USER.cuit,
      passwordHash: await bcrypt.hash(TP_USER.password, 10),
      role: "STUDENT",
      groupId: TP_USER.groupId,
      wallet: {
        create: { cvu: cvu(), alias: TP_USER.alias, balance: new Prisma.Decimal(0) },
      },
    },
    include: { wallet: true },
  });

  console.log("✅ Alumno del TP creado.\n");
  print(user.name, user.dni, user.wallet!.alias, user.wallet!.cvu);
}

function print(name: string, dni: string | null, alias: string, cvuNum: string) {
  console.log(`   Nombre y apellido: ${name}`);
  console.log(`   DNI:               ${dni}`);
  console.log(`   Alias:             ${alias}`);
  console.log(`   CVU:               ${cvuNum}`);
  console.log(`   Email / clave:     ${TP_USER.email} / ${TP_USER.password}`);
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
