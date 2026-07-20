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
    { name: "Sofía Gómez", email: "sofia@colepay.edu", alias: "sofia.sol.mar", balance: 5000, groupId: grupoA.id },
    { name: "Mateo Pérez", email: "mateo@colepay.edu", alias: "mateo.rio.cielo", balance: 3200, groupId: grupoA.id },
    { name: "Valentina Ruiz", email: "valen@colepay.edu", alias: "valen.luna.flor", balance: 8000, groupId: grupoA.id },
    { name: "Benjamín Díaz", email: "benja@colepay.edu", alias: "benja.monte.faro", balance: 1500, groupId: grupoB.id },
    { name: "Martina López", email: "martina@colepay.edu", alias: "martina.nube.coral", balance: 6400, groupId: grupoB.id },
  ];

  for (const a of alumnos) {
    await upsertUser({
      name: a.name,
      email: a.email,
      password: "alumno1234",
      role: "STUDENT",
      alias: a.alias,
      balance: a.balance,
      groupId: a.groupId,
    });
  }

  console.log("✅ Listo. Usuarios de prueba:");
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
