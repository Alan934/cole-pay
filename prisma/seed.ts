import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Genera un CVU ficticio de 22 dígitos.
function cvu(): string {
  let s = "";
  for (let i = 0; i < 22; i++) s += Math.floor(Math.random() * 10);
  return s;
}

/** Usuario de quinto año: atiende el banco, no tiene billetera propia. */
async function upsertStaff(opts: {
  name: string;
  email: string;
  password: string;
  role: "BANK_ADMIN" | "BANK_EMPLOYEE";
  bankId?: string | null;
}) {
  const existing = await prisma.user.findUnique({
    where: { email: opts.email },
  });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      name: opts.name,
      email: opts.email,
      passwordHash: await bcrypt.hash(opts.password, 10),
      role: opts.role,
      bankId: opts.bankId ?? null,
    },
  });
}

/**
 * Banco con su cuenta operativa y su capital inicial. La cuenta es un usuario
 * con rol BANK que nunca inicia sesión: existe para que los movimientos del
 * banco usen el mismo libro mayor que los de los alumnos.
 */
async function upsertBank(opts: {
  name: string;
  slug: string;
  color: string;
  defaultLimit: number;
  monthlyRatePct: number;
  closingDay: number;
  dueDays: number;
  loanRatePct: number;
  maxLoanAmount: number;
  capital: number;
}) {
  const existing = await prisma.bank.findUnique({ where: { name: opts.name } });
  if (existing) return existing;

  const account = await prisma.user.create({
    data: {
      name: opts.name,
      email: `${opts.slug}@banco.colepay.local`,
      passwordHash: await bcrypt.hash(`${opts.slug}-sin-login`, 10),
      role: "BANK",
      wallet: {
        create: {
          cvu: cvu(),
          alias: `${opts.slug}.banco.colepay`,
          balance: new Prisma.Decimal(opts.capital),
        },
      },
    },
  });

  const bank = await prisma.bank.create({
    data: {
      name: opts.name,
      slug: opts.slug,
      color: opts.color,
      defaultLimit: new Prisma.Decimal(opts.defaultLimit),
      monthlyRatePct: new Prisma.Decimal(opts.monthlyRatePct),
      closingDay: opts.closingDay,
      dueDays: opts.dueDays,
      loanRatePct: new Prisma.Decimal(opts.loanRatePct),
      maxLoanAmount: new Prisma.Decimal(opts.maxLoanAmount),
      accountId: account.id,
    },
  });

  // El capital inicial queda registrado como emisión del Banco Central.
  await prisma.transaction.create({
    data: {
      type: "BANK_FUNDING",
      amount: new Prisma.Decimal(opts.capital),
      description: `Capital inicial de ${opts.name}`,
      senderId: null,
      receiverId: account.id,
    },
  });

  return bank;
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
    const existing = await prisma.depositTerm.findFirst({
      where: { bankId: null, days: t.days },
      select: { id: true },
    });
    if (!existing) {
      await prisma.depositTerm.create({
        data: { days: t.days, tnaPct: new Prisma.Decimal(t.tnaPct) },
      });
    }
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

  // Los tres bancos que atienden los alumnos de quinto.
  const bancos = await Promise.all([
    upsertBank({
      name: "Banco del Sol",
      slug: "sol",
      color: "#f59e0b",
      defaultLimit: 5000,
      monthlyRatePct: 8,
      closingDay: 25,
      dueDays: 10,
      loanRatePct: 7,
      maxLoanAmount: 20_000,
      capital: 150_000,
    }),
    upsertBank({
      name: "Banco Río Verde",
      slug: "rio-verde",
      color: "#10b981",
      defaultLimit: 4000,
      monthlyRatePct: 6,
      closingDay: 20,
      dueDays: 12,
      loanRatePct: 5,
      maxLoanAmount: 15_000,
      capital: 150_000,
    }),
    upsertBank({
      name: "Banco Andes",
      slug: "andes",
      color: "#6366f1",
      defaultLimit: 6000,
      monthlyRatePct: 10,
      closingDay: 28,
      dueDays: 8,
      loanRatePct: 9,
      maxLoanAmount: 30_000,
      capital: 150_000,
    }),
  ]);

  /**
   * Pizarra de tasas de cada banco y comisión de cheques.
   *
   * La TNA que paga por los depósitos sale de su propia tasa de préstamo
   * anualizada, siempre por debajo: así el spread arranca a favor del banco y
   * los chicos ven de entrada de dónde sale la ganancia. Cada banco después la
   * mueve desde el mostrador.
   */
  for (const [i, banco] of bancos.entries()) {
    const yaTiene = await prisma.depositTerm.count({ where: { bankId: banco.id } });
    if (yaTiene === 0) {
      const anual = Number(banco.loanRatePct) * 12;
      const pizarra = [
        { days: 7, tnaPct: Math.round(anual * 0.45) },
        { days: 14, tnaPct: Math.round(anual * 0.55) },
        { days: 30, tnaPct: Math.round(anual * 0.65) },
      ];
      await prisma.depositTerm.createMany({
        data: pizarra.map((t) => ({
          bankId: banco.id,
          days: t.days,
          tnaPct: new Prisma.Decimal(t.tnaPct),
        })),
      });
    }
    if (Number(banco.chequeFeePct) === 0) {
      await prisma.bank.update({
        where: { id: banco.id },
        data: { chequeFeePct: new Prisma.Decimal([1, 0.5, 2][i] ?? 1) },
      });
    }
  }

  // Profe de quinto: administra los bancos, no el resto del sistema.
  await upsertStaff({
    name: "Profe de quinto",
    email: "bancos@colepay.edu",
    password: "bancos1234",
    role: "BANK_ADMIN",
  });

  // Un par de empleados de ejemplo para el primer banco.
  await upsertStaff({
    name: "Lucía Álvarez",
    email: "lucia@colepay.edu",
    password: "banco1234",
    role: "BANK_EMPLOYEE",
    bankId: bancos[0].id,
  });
  await upsertStaff({
    name: "Tomás Sosa",
    email: "tomas@colepay.edu",
    password: "banco1234",
    role: "BANK_EMPLOYEE",
    bankId: bancos[0].id,
  });

  // Los alumnos de ejemplo ya son clientes del primer banco, que es el
  // principal de todos. Sin adhesión no pueden pedir tarjeta, préstamo ni
  // hacer plazos fijos: en producción lo hacen en el mostrador.
  const lucia = await prisma.user.findUniqueOrThrow({
    where: { email: "lucia@colepay.edu" },
  });
  const clientes = await prisma.user.findMany({
    where: { role: "STUDENT", email: { in: alumnos.map((a) => a.email) } },
    select: { id: true },
  });
  for (const c of clientes) {
    await prisma.bankMembership.upsert({
      where: { studentId_bankId: { studentId: c.id, bankId: bancos[0].id } },
      update: {},
      create: {
        studentId: c.id,
        bankId: bancos[0].id,
        registeredById: lucia.id,
      },
    });
  }

  console.log("✅ Listo. Usuarios de prueba:");
  console.log("   Rendimientos: desactivados (activalos en /admin/rendimientos)");
  console.log("   ADMIN   → admin@colepay.edu / admin1234");
  console.log("   ALUMNO  → sofia@colepay.edu / alumno1234 (y otros)");
  console.log("   PROFE 5° → bancos@colepay.edu / bancos1234");
  console.log("   BANCO   → lucia@colepay.edu / banco1234 (Banco del Sol)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
