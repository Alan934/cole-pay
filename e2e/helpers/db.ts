import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { TEST_DATABASE_URL } from "../../playwright.config";

/** Cliente Prisma apuntado explícitamente a la base de TEST. */
export const db = new PrismaClient({
  datasources: { db: { url: TEST_DATABASE_URL } },
});

export const PASSWORD_ADMIN = "admin1234";
export const PASSWORD_STUDENT = "alumno1234";

export const USERS = {
  admin: "profe@test.colepay",
  admin2: "profe2@test.colepay",
  sofia: "sofia@test.colepay",
  mateo: "mateo@test.colepay",
  valen: "valen@test.colepay",
  benja: "benja@test.colepay",
};

const D = (n: number) => new Prisma.Decimal(n);

function cvu(seed: number): string {
  return String(seed).padStart(22, "7");
}

/** Borra todos los datos respetando el orden de dependencias. */
export async function resetDb() {
  await db.notification.deleteMany();
  await db.paymentRequest.deleteMany();
  await db.savingsGoal.deleteMany();
  await db.fixedDeposit.deleteMany();
  await db.invoice.deleteMany();
  await db.transaction.deleteMany();
  await db.recurringCharge.deleteMany();
  await db.wallet.deleteMany();
  await db.user.deleteMany();
  await db.group.deleteMany();
}

/**
 * Estado inicial conocido:
 *  - Banco (admin) con 1.000.000
 *  - Grupo 3A2026: Sofía 5000, Mateo 3000, Valentina 8000
 *  - Grupo 3B2026: Benjamín 1500
 */
export async function seedDb() {
  const hashAdmin = await bcrypt.hash(PASSWORD_ADMIN, 10);
  const hashStudent = await bcrypt.hash(PASSWORD_STUDENT, 10);

  const g3a = await db.group.create({ data: { name: "3A2026" } });
  const g3b = await db.group.create({ data: { name: "3B2026" } });

  const mk = async (opts: {
    name: string;
    email: string;
    hash: string;
    role: "ADMIN" | "STUDENT";
    alias: string;
    balance: number;
    groupId?: string;
    seed: number;
  }) =>
    db.user.create({
      data: {
        name: opts.name,
        email: opts.email,
        passwordHash: opts.hash,
        role: opts.role,
        groupId: opts.groupId ?? null,
        wallet: {
          create: {
            cvu: cvu(opts.seed),
            alias: opts.alias,
            balance: D(opts.balance),
          },
        },
      },
      include: { wallet: true },
    });

  const admin = await mk({
    name: "Profe Banco",
    email: USERS.admin,
    hash: hashAdmin,
    role: "ADMIN",
    alias: "banco.central.test",
    balance: 1_000_000,
    seed: 1,
  });
  const admin2 = await mk({
    name: "Profe Dos",
    email: USERS.admin2,
    hash: hashAdmin,
    role: "ADMIN",
    alias: "banco.dos.test",
    balance: 0,
    seed: 2,
  });
  const sofia = await mk({
    name: "Sofia Test",
    email: USERS.sofia,
    hash: hashStudent,
    role: "STUDENT",
    alias: "sofia.test.uno",
    balance: 5000,
    groupId: g3a.id,
    seed: 3,
  });
  const mateo = await mk({
    name: "Mateo Test",
    email: USERS.mateo,
    hash: hashStudent,
    role: "STUDENT",
    alias: "mateo.test.dos",
    balance: 3000,
    groupId: g3a.id,
    seed: 4,
  });
  const valen = await mk({
    name: "Valentina Test",
    email: USERS.valen,
    hash: hashStudent,
    role: "STUDENT",
    alias: "valen.test.tres",
    balance: 8000,
    groupId: g3a.id,
    seed: 5,
  });
  const benja = await mk({
    name: "Benjamin Test",
    email: USERS.benja,
    hash: hashStudent,
    role: "STUDENT",
    alias: "benja.test.cuatro",
    balance: 1500,
    groupId: g3b.id,
    seed: 6,
  });

  return { g3a, g3b, admin, admin2, sofia, mateo, valen, benja };
}

export async function resetAndSeed() {
  await resetDb();
  return seedDb();
}

/** Saldo actual de un usuario por email. */
export async function balanceOf(email: string): Promise<number> {
  const u = await db.user.findUnique({
    where: { email },
    include: { wallet: true },
  });
  return Number(u?.wallet?.balance ?? 0);
}

/**
 * Dinero total del sistema = saldos + ahorros apartados + plazos fijos activos.
 * Debe permanecer constante ante transferencias/pagos (solo cambia con
 * emisión e interés).
 */
export async function totalMoney(): Promise<number> {
  const wallets = await db.wallet.aggregate({ _sum: { balance: true } });
  const goals = await db.savingsGoal.aggregate({ _sum: { savedAmount: true } });
  const deps = await db.fixedDeposit.aggregate({
    where: { status: "ACTIVE" },
    _sum: { principal: true },
  });
  return (
    Number(wallets._sum.balance ?? 0) +
    Number(goals._sum.savedAmount ?? 0) +
    Number(deps._sum.principal ?? 0)
  );
}
