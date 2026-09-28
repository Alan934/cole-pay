/**
 * Escenario compartido por los generadores de capturas de las guías de quinto
 * (el mostrador del banco y el panel de la profe).
 *
 * Siembra un día de trabajo creíble en "Banco del Sol": solicitudes de tarjeta
 * y de préstamo esperando respuesta, tarjetas emitidas con resúmenes (una en
 * mora), cheques para cobrar hoy —uno sin fondos y uno diferido—, movimientos
 * de ventanilla, una pizarra de plazos fijos con depósitos tomados y la caja
 * con plata. Sin esto las pantallas saldrían vacías y no explicarían nada.
 */
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { db, resetDb, resetSettings, seedDb } from "./db";

const D = (n: number) => new Prisma.Decimal(n);
const day = 24 * 60 * 60 * 1000;
const ago = (d: number) => new Date(Date.now() - d * day);
const ahead = (d: number) => new Date(Date.now() + d * day);

export const BANK_USERS = {
  /** Profe de quinto: administra los tres bancos. */
  profe: "quinto@test.colepay",
  /** Cajera del Banco del Sol: es la que aparece en las capturas. */
  lucia: "lucia@test.colepay",
  tomas: "tomas@test.colepay",
  /** Empleado todavía sin banco: dispara el aviso del panel de la profe. */
  nico: "nico@test.colepay",
};

export const PASSWORD_BANK = "banco1234";

/** Nombre del banco que se fotografía. */
export const MAIN_BANK = "Banco del Sol";

function digits(n: number, len: number) {
  return String(n).padStart(len, "0");
}

/** Cuenta operativa del banco: un User con rol BANK que nunca inicia sesión. */
async function createBankAccount(name: string, slug: string, capital: number) {
  const passwordHash = await bcrypt.hash(`${slug}-sin-login`, 10);
  return db.user.create({
    data: {
      name,
      email: `${slug}@banco.test.colepay`,
      passwordHash,
      role: "BANK",
      wallet: {
        create: {
          cvu: digits(Number(`9${slug.length}`), 22),
          alias: `banco.${slug}.test`,
          balance: D(capital),
        },
      },
    },
    include: { wallet: true },
  });
}

async function createBank(opts: {
  name: string;
  slug: string;
  color: string;
  capital: number;
  defaultLimit: number;
  monthlyRatePct: number;
  closingDay: number;
  dueDays: number;
  loanRatePct: number;
  maxLoanAmount: number;
  chequeFeePct: number;
}) {
  const account = await createBankAccount(opts.name, opts.slug, opts.capital);
  return db.bank.create({
    data: {
      name: opts.name,
      slug: opts.slug,
      color: opts.color,
      defaultLimit: D(opts.defaultLimit),
      monthlyRatePct: D(opts.monthlyRatePct),
      closingDay: opts.closingDay,
      dueDays: opts.dueDays,
      loanRatePct: D(opts.loanRatePct),
      maxLoanAmount: D(opts.maxLoanAmount),
      chequeFeePct: D(opts.chequeFeePct),
      accountId: account.id,
    },
    include: { account: { include: { wallet: true } } },
  });
}

async function createStaff(opts: {
  name: string;
  email: string;
  role: "BANK_ADMIN" | "BANK_EMPLOYEE";
  bankId?: string | null;
}) {
  const passwordHash = await bcrypt.hash(PASSWORD_BANK, 10);
  // Los usuarios de quinto no tienen billetera: sólo operan el mostrador.
  return db.user.create({
    data: {
      name: opts.name,
      email: opts.email,
      passwordHash,
      role: opts.role,
      bankId: opts.bankId ?? null,
    },
  });
}

export async function seedBankScenario() {
  await resetDb();
  await resetSettings({ interestEnabled: true, balanceTnaPct: 36.5 });
  const s = await seedDb();
  const { sofia, mateo, valen, benja, admin } = s;

  /* --- Los tres bancos de la cursada --- */
  const sol = await createBank({
    name: MAIN_BANK,
    slug: "sol",
    color: "#f59e0b",
    capital: 128_400,
    defaultLimit: 5000,
    monthlyRatePct: 8,
    closingDay: 25,
    dueDays: 10,
    loanRatePct: 7,
    maxLoanAmount: 20_000,
    chequeFeePct: 1,
  });
  const rio = await createBank({
    name: "Banco Río Verde",
    slug: "rio-verde",
    color: "#10b981",
    capital: 96_500,
    defaultLimit: 4000,
    monthlyRatePct: 6,
    closingDay: 20,
    dueDays: 12,
    loanRatePct: 5,
    maxLoanAmount: 15_000,
    chequeFeePct: 0.5,
  });
  const andes = await createBank({
    name: "Banco Andes",
    slug: "andes",
    color: "#6366f1",
    capital: 45_000,
    defaultLimit: 6000,
    monthlyRatePct: 10,
    closingDay: 28,
    dueDays: 8,
    loanRatePct: 9,
    maxLoanAmount: 30_000,
    chequeFeePct: 2,
  });

  /* --- El equipo --- */
  await createStaff({
    name: "Profe de quinto",
    email: BANK_USERS.profe,
    role: "BANK_ADMIN",
  });
  const lucia = await createStaff({
    name: "Lucía Álvarez",
    email: BANK_USERS.lucia,
    role: "BANK_EMPLOYEE",
    bankId: sol.id,
  });
  await createStaff({
    name: "Tomás Sosa",
    email: BANK_USERS.tomas,
    role: "BANK_EMPLOYEE",
    bankId: sol.id,
  });
  // Sin banco a propósito: el panel de la profe avisa que hay que asignarlo.
  await createStaff({
    name: "Nicolás Ferro",
    email: BANK_USERS.nico,
    role: "BANK_EMPLOYEE",
    bankId: null,
  });
  await createStaff({
    name: "Julia Ríos",
    email: "julia@test.colepay",
    role: "BANK_EMPLOYEE",
    bankId: rio.id,
  });

  /* --- Solicitudes de tarjeta esperando respuesta --- */
  await db.cardApplication.create({
    data: {
      bankId: sol.id,
      applicantId: sofia.id,
      requestedLimit: D(6000),
      monthlyIncome: D(12_000),
      purpose: "Comprar la mercadería del stand y pagarla a fin de mes.",
      createdAt: ago(1),
    },
  });
  await db.cardApplication.create({
    data: {
      bankId: sol.id,
      applicantId: valen.id,
      requestedLimit: D(9000),
      monthlyIncome: D(7500),
      purpose: "Quiero empezar a vender remeras y necesito capital.",
      createdAt: ago(0.4),
    },
  });
  // Una en otro banco: la profe la ve desde su panel de supervisión.
  await db.cardApplication.create({
    data: {
      bankId: andes.id,
      applicantId: benja.id,
      requestedLimit: D(4000),
      monthlyIncome: D(3000),
      purpose: "Para las compras del kiosco.",
      createdAt: ago(3),
    },
  });

  /* --- Tarjetas ya emitidas, con consumos y resúmenes --- */
  const cardMateo = await db.creditCard.create({
    data: {
      bankId: sol.id,
      ownerId: mateo.id,
      issuedById: lucia.id,
      brand: "VISA",
      number: "4539148803436467",
      last4: "6467",
      holderName: "MATEO TEST",
      expMonth: 9,
      expYear: new Date().getFullYear() + 3,
      cvv: "123",
      creditLimit: D(5000),
      closingDay: 25,
      dueDays: 10,
      monthlyRatePct: D(8),
      issuedAt: ago(20),
      lastClosedAt: ago(6),
    },
  });
  // Consumos del período en curso (todavía sin facturar).
  await db.cardCharge.createMany({
    data: [
      {
        cardId: cardMateo.id,
        kind: "PURCHASE",
        amount: D(850),
        description: "Kiosco de Valentina",
        category: "Comida",
        merchantId: valen.id,
        createdAt: ago(4),
      },
      {
        cardId: cardMateo.id,
        kind: "PURCHASE",
        amount: D(1200),
        description: "Insumos del stand",
        category: "Insumos",
        merchantId: sofia.id,
        createdAt: ago(2),
      },
    ],
  });
  // Resumen cerrado, todavía impago pero sin vencer.
  await db.cardStatement.create({
    data: {
      cardId: cardMateo.id,
      periodStart: ago(36),
      periodEnd: ago(6),
      dueDate: ahead(4),
      status: "CLOSED",
      chargesTotal: D(2300),
      total: D(2300),
      paid: D(0),
      closedAt: ago(6),
    },
  });

  const cardBenja = await db.creditCard.create({
    data: {
      bankId: sol.id,
      ownerId: benja.id,
      issuedById: lucia.id,
      brand: "MASTERCARD",
      number: "5500005555555559",
      last4: "5559",
      holderName: "BENJAMIN TEST",
      expMonth: 4,
      expYear: new Date().getFullYear() + 2,
      cvv: "456",
      creditLimit: D(3000),
      closingDay: 25,
      dueDays: 10,
      monthlyRatePct: D(8),
      issuedAt: ago(40),
      lastClosedAt: ago(12),
    },
  });
  // Resumen vencido: el cliente entra en mora y el banco le cobra interés.
  await db.cardStatement.create({
    data: {
      cardId: cardBenja.id,
      periodStart: ago(42),
      periodEnd: ago(12),
      dueDate: ago(2),
      status: "OVERDUE",
      chargesTotal: D(1600),
      interest: D(128),
      total: D(1728),
      paid: D(0),
      closedAt: ago(12),
    },
  });

  /* --- Préstamos --- */
  await db.loan.create({
    data: {
      bankId: sol.id,
      borrowerId: valen.id,
      requestedAmount: D(10_000),
      requestedInstallments: 3,
      monthlyIncome: D(7500),
      purpose: "Comprar la máquina de estampar para el emprendimiento.",
      createdAt: ago(1),
    },
  });
  await db.loan.create({
    data: {
      bankId: andes.id,
      borrowerId: sofia.id,
      requestedAmount: D(6000),
      requestedInstallments: 4,
      monthlyIncome: D(12_000),
      purpose: "Stock para la feria.",
      createdAt: ago(2),
    },
  });
  // Uno ya desembolsado, para que se vea la plata prestada.
  await db.loan.create({
    data: {
      bankId: sol.id,
      borrowerId: mateo.id,
      status: "ACTIVE",
      requestedAmount: D(8000),
      requestedInstallments: 4,
      monthlyIncome: D(9000),
      purpose: "Ampliar el puesto.",
      createdAt: ago(15),
      reviewedAt: ago(14),
      principal: D(8000),
      monthlyRatePct: D(7),
      installments: 4,
      installmentAmount: D(2560),
      totalToRepay: D(10_240),
      paidAmount: D(2560),
      disbursedAt: ago(14),
    },
  });

  /* --- Cheques en la ventanilla --- */
  const chequeBase = {
    registeredById: sofia.id,
  };
  // Para cobrar hoy, con fondos.
  await db.cheque.create({
    data: {
      ...chequeBase,
      number: "00001207",
      amount: D(2500),
      concept: "Publicidad en el stand",
      drawerId: sofia.id,
      payeeId: mateo.id,
      issuedAt: ago(2),
      payableAt: ago(2),
    },
  });
  // Para cobrar hoy, pero el librador no tiene fondos: va a rebotar.
  await db.cheque.create({
    data: {
      number: "00001208",
      amount: D(3200),
      concept: "Seña del pedido de remeras",
      drawerId: benja.id,
      payeeId: valen.id,
      registeredById: benja.id,
      issuedAt: ago(1),
      payableAt: ago(1),
    },
  });
  // Diferido: recién se puede cobrar en cinco días.
  await db.cheque.create({
    data: {
      number: "00001209",
      amount: D(4000),
      concept: "Mercadería a 5 días",
      drawerId: mateo.id,
      payeeId: sofia.id,
      registeredById: mateo.id,
      issuedAt: ago(1),
      payableAt: ahead(5),
    },
  });
  // Historial de la ventanilla: uno cobrado y uno rechazado.
  await db.cheque.create({
    data: {
      number: "00001195",
      amount: D(1800),
      concept: "Alquiler del stand",
      drawerId: valen.id,
      payeeId: mateo.id,
      registeredById: valen.id,
      bankId: sol.id,
      paidById: lucia.id,
      status: "PAID",
      fee: D(18),
      issuedAt: ago(9),
      payableAt: ago(9),
      paidAt: ago(8),
    },
  });
  await db.cheque.create({
    data: {
      number: "00001188",
      amount: D(5200),
      concept: "Compra de insumos",
      drawerId: benja.id,
      payeeId: sofia.id,
      registeredById: benja.id,
      bankId: sol.id,
      paidById: lucia.id,
      status: "BOUNCED",
      bounceReason: "Sin fondos suficientes",
      issuedAt: ago(11),
      payableAt: ago(11),
      bouncedAt: ago(10),
    },
  });

  /* --- Ventanilla de efectivo --- */
  await db.cashOperation.create({
    data: {
      bankId: sol.id,
      customerId: sofia.id,
      tellerId: lucia.id,
      kind: "DEPOSIT",
      amount: D(3500),
      note: "Venta del kiosco",
      createdAt: ago(3),
    },
  });
  await db.cashOperation.create({
    data: {
      bankId: sol.id,
      customerId: mateo.id,
      tellerId: lucia.id,
      kind: "DEPOSIT",
      amount: D(2200),
      note: "Recaudación de la feria",
      createdAt: ago(2),
    },
  });
  await db.cashOperation.create({
    data: {
      bankId: sol.id,
      customerId: valen.id,
      tellerId: lucia.id,
      kind: "WITHDRAWAL",
      amount: D(1500),
      note: "Para comprar insumos",
      createdAt: ago(1),
    },
  });

  /* --- Pizarra de plazos fijos del banco y depósitos tomados --- */
  await db.depositTerm.createMany({
    data: [
      { bankId: sol.id, days: 7, tnaPct: D(38) },
      { bankId: sol.id, days: 14, tnaPct: D(46) },
      { bankId: sol.id, days: 30, tnaPct: D(55) },
    ],
  });
  await db.fixedDeposit.create({
    data: {
      userId: valen.id,
      bankId: sol.id,
      principal: D(5000),
      ratePct: D(55),
      termDays: 30,
      createdAt: ago(10),
      maturesAt: ahead(20),
    },
  });
  await db.fixedDeposit.create({
    data: {
      userId: mateo.id,
      bankId: sol.id,
      principal: D(3000),
      ratePct: D(46),
      termDays: 14,
      createdAt: ago(12),
      maturesAt: ahead(2),
    },
  });

  /* --- Movimientos de la cuenta del banco --- */
  const tx = (data: {
    type: any;
    amount: number;
    description: string;
    senderId?: string | null;
    receiverId?: string | null;
    daysAgo: number;
  }) =>
    db.transaction.create({
      data: {
        type: data.type,
        amount: D(data.amount),
        description: data.description,
        senderId: data.senderId ?? null,
        receiverId: data.receiverId ?? null,
        bankId: sol.id,
        timestamp: ago(data.daysAgo),
      },
    });

  await tx({
    type: "BANK_FUNDING",
    amount: 150_000,
    description: "Capital inicial del Banco Central",
    senderId: admin.id,
    receiverId: sol.account.id,
    daysAgo: 25,
  });
  await tx({
    type: "LOAN_DISBURSEMENT",
    amount: 8000,
    description: "Préstamo a Mateo Test · 4 cuotas",
    senderId: sol.account.id,
    receiverId: mateo.id,
    daysAgo: 14,
  });
  await tx({
    type: "CARD_PURCHASE",
    amount: 1200,
    description: "Consumo con tarjeta ••••6467 en Sofia Test",
    senderId: sol.account.id,
    receiverId: sofia.id,
    daysAgo: 2,
  });
  await tx({
    type: "CASH_DEPOSIT",
    amount: 3500,
    description: "Depósito en efectivo de Sofia Test",
    senderId: null,
    receiverId: sofia.id,
    daysAgo: 3,
  });
  await tx({
    type: "CHEQUE_PAYMENT",
    amount: 1800,
    description: "Cheque 0000 1195 pagado a Mateo Test",
    senderId: valen.id,
    receiverId: mateo.id,
    daysAgo: 8,
  });
  await tx({
    type: "LOAN_PAYMENT",
    amount: 2560,
    description: "Cuota 1 de 4 del préstamo de Mateo Test",
    senderId: mateo.id,
    receiverId: sol.account.id,
    daysAgo: 4,
  });
  await tx({
    type: "FIXED_DEPOSIT_OPEN",
    amount: 5000,
    description: "Plazo fijo de Valentina Test · 30 días",
    senderId: valen.id,
    receiverId: sol.account.id,
    daysAgo: 10,
  });

  return { sol, rio, andes, lucia, ...s };
}
