import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Genera un CVU ficticio de 22 dígitos.
function cvu(): string {
  let s = "";
  for (let i = 0; i < 22; i++) s += Math.floor(Math.random() * 10);
  return s;
}

async function upsertUser(opts: {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "STUDENT";
  alias: string;
  dni?: string | null;
  cuit?: string | null;
  balance?: number;
  groupId?: string | null;
}) {
  const passwordHash = await bcrypt.hash(opts.password, 10);
  const existing = await prisma.user.findUnique({
    where: { email: opts.email },
  });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      name: opts.name,
      email: opts.email,
      dni: opts.dni ?? null,
      cuit: opts.cuit ?? null,
      passwordHash,
      role: opts.role,
      groupId: opts.groupId ?? null,
      wallet: {
        create: {
          cvu: cvu(),
          alias: opts.alias,
          balance: new Prisma.Decimal(opts.balance ?? 0),
        },
      },
    },
  });
}

async function main() {
  console.log("🌱 Sembrando datos de ColePay...");

  // Configuración económica del banco (fila única).
  // Arranca desactivada: la profe la enciende cuando da el tema.
  const suggested = {
    balanceTnaPct: new Prisma.Decimal(30), // saldo disponible
    goalsTnaPct: new Prisma.Decimal(55), // metas de ahorro
    goalsLockDays: 7,
    minBalanceToEarn: new Prisma.Decimal(100),
  };
  const existing = await prisma.bankSettings.findUnique({
    where: { id: "singleton" },
  });
  if (!existing) {
    await prisma.bankSettings.create({
      data: { id: "singleton", interestEnabled: false, ...suggested },
    });
  } else if (existing.balanceTnaPct.equals(0) && existing.goalsTnaPct.equals(0)) {
    // La fila la creó la migración con ceros y nadie la tocó todavía:
    // le cargamos las tasas sugeridas. Si ya las configuraste, no se pisan.
    await prisma.bankSettings.update({
      where: { id: "singleton" },
      data: suggested,
    });
  }

  // Plazos de plazo fijo ofrecidos por el banco (TNA anual).
  // A mayor plazo, mayor TNA: premia inmovilizar el dinero más tiempo.
  const terms = [
    { days: 7, tnaPct: 70 },
    { days: 14, tnaPct: 85 },
    { days: 30, tnaPct: 100 },
  ];
  for (const t of terms) {
    await prisma.depositTerm.upsert({
      where: { days: t.days },
      update: {},
      create: { days: t.days, tnaPct: new Prisma.Decimal(t.tnaPct) },
    });
  }

  // Grupos
  const grupoA = await prisma.group.upsert({
    where: { name: "3A2026" },
    update: {},
    create: { name: "3A2026" },
  });
  const grupoB = await prisma.group.upsert({
    where: { name: "3B2026" },
    update: {},
    create: { name: "3B2026" },
  });

  // Admin / Banco Central
  await upsertUser({
    name: "Profe (Banco Central)",
    email: "admin@colepay.edu",
    password: "admin1234",
    role: "ADMIN",
    alias: "banco.central.colepay",
    balance: 1_000_000,
  });

  // Alumnos de ejemplo
  const alumnos = [
    // Algunos con CUIT y otros sin: en el comprobante se ve cómo cae de vuelta al DNI.
    { name: "Sofía Gómez", email: "sofia@colepay.edu", dni: "48123001", cuit: "27481230014", alias: "sofia.sol.mar", balance: 5000, groupId: grupoA.id },
    { name: "Mateo Pérez", email: "mateo@colepay.edu", dni: "48123002", cuit: "20481230029", alias: "mateo.rio.cielo", balance: 3200, groupId: grupoA.id },
    { name: "Valentina Ruiz", email: "valen@colepay.edu", dni: "48123003", cuit: null, alias: "valen.luna.flor", balance: 8000, groupId: grupoA.id },
    { name: "Benjamín Díaz", email: "benja@colepay.edu", dni: "48123004", cuit: null, alias: "benja.monte.faro", balance: 1500, groupId: grupoB.id },
    { name: "Martina López", email: "martina@colepay.edu", dni: "48123005", cuit: null, alias: "martina.nube.coral", balance: 6400, groupId: grupoB.id },
  ];

  for (const a of alumnos) {
    await upsertUser({
      name: a.name,
      email: a.email,
      password: "alumno1234",
      role: "STUDENT",
      alias: a.alias,
      dni: a.dni,
      cuit: a.cuit,
      balance: a.balance,
      groupId: a.groupId,
    });
  }

  console.log("✅ Listo. Usuarios de prueba:");
  console.log("   Rendimientos: desactivados (activalos en /admin/rendimientos)");
  console.log("   ADMIN   → admin@colepay.edu / admin1234");
  console.log("   ALUMNO  → sofia@colepay.edu / alumno1234 (y otros)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
