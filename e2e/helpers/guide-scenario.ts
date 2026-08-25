/**
 * Escenario compartido por los generadores de capturas de las guías.
 *
 * Siembra una situación creíble para "Sofía": saldo de trabajo, historial de
 * movimientos con categorías, cuentas por pagar, metas, plazos fijos, avisos
 * e intereses acreditados. Sin esto las capturas saldrían vacías y no
 * explicarían nada.
 */
import { Prisma } from "@prisma/client";
import { db, resetDb, resetSettings, seedDb } from "./db";

const D = (n: number) => new Prisma.Decimal(n);
const day = 24 * 60 * 60 * 1000;
const ago = (d: number) => new Date(Date.now() - d * day);
const ahead = (d: number) => new Date(Date.now() + d * day);

export async function seedGuideScenario() {
  await resetDb();
  await resetSettings({
    interestEnabled: true,
    balanceTnaPct: 36.5,
    goalsTnaPct: 73,
    goalsLockDays: 3,
    inflationEnabled: true,
    monthlyInflationPct: 4,
  });
  const s = await seedDb();
  const sofia = s.sofia;
  const mateo = s.mateo;
  const valen = s.valen;
  const admin = s.admin;

  // Saldo de trabajo para las capturas.
  await db.wallet.update({
    where: { userId: sofia.id },
    data: { balance: D(8750.4) },
  });

  /* --- Movimientos: el historial que se ve en Inicio y Actividad --- */
  const tx = (data: {
    type: any;
    amount: number;
    description: string;
    category?: string;
    senderId?: string | null;
    receiverId?: string | null;
    daysAgo: number;
  }) =>
    db.transaction.create({
      data: {
        type: data.type,
        amount: D(data.amount),
        description: data.description,
        category: data.category ?? null,
        senderId: data.senderId ?? null,
        receiverId: data.receiverId ?? null,
        timestamp: ago(data.daysAgo),
      },
    });

  await tx({
    type: "DEPOSIT",
    amount: 5000,
    description: "Carga de saldo inicial",
    receiverId: sofia.id,
    daysAgo: 12,
  });
  await tx({
    type: "PRIZE",
    amount: 1500,
    description: "Premio: mejor stand de la feria",
    receiverId: sofia.id,
    daysAgo: 8,
  });
  await tx({
    type: "TRANSFER",
    amount: 1200,
    description: "Tu parte del regalo",
    category: "General",
    senderId: mateo.id,
    receiverId: sofia.id,
    daysAgo: 6,
  });
  await tx({
    type: "PAYMENT",
    amount: 1200,
    description: "Alquiler Stand A - Semana 2",
    category: "Servicios",
    senderId: sofia.id,
    receiverId: admin.id,
    daysAgo: 5,
  });
  await tx({
    type: "TRANSFER",
    amount: 650,
    description: "Empanadas del recreo",
    category: "Comida",
    senderId: sofia.id,
    receiverId: valen.id,
    daysAgo: 3,
  });
  await tx({
    type: "TRANSFER",
    amount: 400,
    description: "Cartulinas y fibrones",
    category: "Materiales",
    senderId: sofia.id,
    receiverId: mateo.id,
    daysAgo: 2,
  });
  await tx({
    type: "FINE",
    amount: 200,
    description: "Multa: entrega fuera de término",
    category: "Multas",
    senderId: sofia.id,
    receiverId: admin.id,
    daysAgo: 1,
  });

  /* --- Cuentas a pagar --- */
  await db.invoice.create({
    data: {
      description: "Alquiler Stand A - Semana 3",
      amount: D(1200),
      dueDate: ahead(3),
      studentId: sofia.id,
      createdById: admin.id,
      createdAt: ago(1),
    },
  });
  await db.invoice.create({
    data: {
      description: "Servicio de luz del stand",
      amount: D(480),
      dueDate: ahead(6),
      studentId: sofia.id,
      createdById: admin.id,
      createdAt: ago(1),
    },
  });
  await db.invoice.create({
    data: {
      description: "Alquiler Stand A - Semana 2",
      amount: D(1200),
      status: "PAID",
      paidAt: ago(5),
      studentId: sofia.id,
      createdById: admin.id,
      createdAt: ago(9),
    },
  });

  /* --- Metas de ahorro --- */
  await db.savingsGoal.create({
    data: {
      name: "Campera nueva",
      targetAmount: D(15000),
      savedAmount: D(6240.5),
      earnedInterest: D(112.3),
      lockedUntil: ahead(2),
      userId: sofia.id,
      createdAt: ago(10),
    },
  });
  await db.savingsGoal.create({
    data: {
      name: "Viaje de egresados",
      targetAmount: D(50000),
      savedAmount: D(3000),
      earnedInterest: D(24.8),
      userId: sofia.id,
      createdAt: ago(4),
    },
  });

  /* --- Plazos fijos: uno en curso, uno listo para cobrar, uno finalizado --- */
  await db.fixedDeposit.create({
    data: {
      principal: D(5000),
      ratePct: D(100),
      termDays: 30,
      maturesAt: ahead(18),
      userId: sofia.id,
      createdAt: ago(12),
    },
  });
  await db.fixedDeposit.create({
    data: {
      principal: D(2000),
      ratePct: D(70),
      termDays: 7,
      maturesAt: ago(1),
      userId: sofia.id,
      createdAt: ago(8),
    },
  });
  await db.fixedDeposit.create({
    data: {
      principal: D(1500),
      ratePct: D(85),
      termDays: 14,
      status: "WITHDRAWN",
      maturesAt: ago(4),
      withdrawnAt: ago(4),
      payoutAmount: D(1548.9),
      userId: sofia.id,
      createdAt: ago(18),
    },
  });

  /* --- Pedidos de cobro --- */
  await db.paymentRequest.create({
    data: {
      amount: D(2500),
      description: "Tu parte del regalo de Euge",
      requesterId: sofia.id,
      createdAt: ago(1),
    },
  });
  await db.paymentRequest.create({
    data: {
      amount: D(800),
      description: "Rifa del curso",
      status: "PAID",
      paidAt: ago(2),
      requesterId: sofia.id,
      payerId: mateo.id,
      createdAt: ago(3),
    },
  });

  /* --- Avisos --- */
  const notif = (
    type: any,
    title: string,
    body: string,
    read: boolean,
    daysAgo: number,
  ) =>
    db.notification.create({
      data: {
        type,
        title,
        body,
        read,
        userId: sofia.id,
        createdAt: ago(daysAgo),
      },
    });

  await notif(
    "NEW_INVOICE",
    "Nueva cuenta a pagar",
    "Alquiler Stand A - Semana 3 por $1.200,00",
    false,
    1,
  );
  await notif(
    "INTEREST_PAID",
    "Ganaste intereses",
    "Se acreditaron $8,75 por el saldo de tu cuenta.",
    false,
    1,
  );
  await notif(
    "MONEY_RECEIVED",
    "Recibiste dinero",
    "Mateo Test te transfirió $1.200,00 — Tu parte del regalo",
    false,
    6,
  );
  await notif(
    "GENERIC",
    "Premio del banco",
    "Te acreditamos $1.500,00: mejor stand de la feria. ¡Felicitaciones!",
    true,
    8,
  );
  await notif(
    "INVOICE_PAID",
    "Pago registrado",
    "Pagaste Alquiler Stand A - Semana 2 por $1.200,00",
    true,
    5,
  );

  /* --- Intereses acreditados: alimentan el gráfico de Rendimientos --- */
  const run = await db.interestRun.create({
    data: {
      days: 10,
      periodEnd: new Date(),
      balanceTnaPct: D(36.5),
      goalsTnaPct: D(73),
      totalPaid: D(120),
      walletsCount: 4,
      trigger: "MANUAL",
    },
  });
  for (let i = 10; i >= 1; i--) {
    const base = 7800 + (10 - i) * 90;
    const interest = Math.round(base * (36.5 / 100) * (1 / 365) * 100) / 100;
    await db.interestAccrual.create({
      data: {
        source: "BALANCE",
        base: D(base),
        tnaPct: D(36.5),
        days: 1,
        interest: D(interest),
        userId: sofia.id,
        runId: run.id,
        createdAt: ago(i),
      },
    });
    const gBase = 6000 + (10 - i) * 20;
    const gInt = Math.round(gBase * (73 / 100) * (1 / 365) * 100) / 100;
    await db.interestAccrual.create({
      data: {
        source: "GOAL",
        base: D(gBase),
        tnaPct: D(73),
        days: 1,
        interest: D(gInt),
        userId: sofia.id,
        runId: run.id,
        createdAt: ago(i),
      },
    });
  }

  return s;
}
