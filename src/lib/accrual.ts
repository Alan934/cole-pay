import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SETTINGS_ID, getSettings } from "@/lib/settings";
import { simpleInterest, wholeDaysBetween, formatFormula } from "@/lib/interest";
import { formatMoney } from "@/lib/utils";

const D = (v: number | string) => new Prisma.Decimal(v);

/** Tope de días liquidables de una sola vez (evita cargar un año por error). */
const MAX_DAYS_PER_RUN = 366;

export type AccrualOutcome =
  | { ok: false; reason: string }
  | {
      ok: true;
      runId: string;
      days: number;
      totalPaid: number;
      walletsCount: number;
    };

type AccrualOptions = {
  /** "CRON" respeta el mínimo de un día; "MANUAL" lo saltea. */
  trigger: "CRON" | "MANUAL";
  /** Días a liquidar. Si no se pasa, se usan los días reales transcurridos. */
  days?: number;
  now?: Date;
};

/**
 * Acredita los intereses de un período sobre el saldo disponible y sobre lo
 * apartado en metas de ahorro.
 *
 * Es **idempotente**: antes de pagar nada reclama el período con un UPDATE
 * condicional sobre BankSettings, así dos corridas simultáneas (o dos clicks)
 * no pueden acreditar dos veces lo mismo.
 */
export async function accrueInterest(
  opts: AccrualOptions,
): Promise<AccrualOutcome> {
  const now = opts.now ?? new Date();
  const settings = await getSettings();

  if (!settings.interestEnabled) {
    return { ok: false, reason: "Los rendimientos están desactivados." };
  }

  const balanceTna = Number(settings.balanceTnaPct);
  const goalsTna = Number(settings.goalsTnaPct);
  if (balanceTna <= 0 && goalsTna <= 0) {
    return { ok: false, reason: "No hay ninguna TNA configurada." };
  }

  // Días a liquidar: los reales transcurridos, o los que pidió el admin.
  const elapsed = settings.lastAccrualAt
    ? wholeDaysBetween(settings.lastAccrualAt, now)
    : 1; // primera liquidación: se paga un día
  const requested = opts.days ?? elapsed;
  const days = Math.min(MAX_DAYS_PER_RUN, Math.floor(requested));

  if (days <= 0) {
    return {
      ok: false,
      reason:
        "Todavía no pasó un día completo desde la última liquidación. " +
        "Si querés adelantar, indicá cuántos días simular.",
    };
  }

  // Reclamo del período. Para el cron exige que haya pasado al menos un día;
  // una corrida manual siempre puede reclamar.
  const claim = await prisma.bankSettings.updateMany({
    where:
      opts.trigger === "CRON"
        ? {
            id: SETTINGS_ID,
            OR: [
              { lastAccrualAt: null },
              { lastAccrualAt: { lte: new Date(now.getTime() - 86_400_000) } },
            ],
          }
        : { id: SETTINGS_ID },
    data: { lastAccrualAt: now },
  });
  if (claim.count === 0) {
    return { ok: false, reason: "Este período ya fue liquidado." };
  }

  const minBalance = settings.minBalanceToEarn;
  const run = await prisma.interestRun.create({
    data: {
      days,
      periodEnd: now,
      balanceTnaPct: settings.balanceTnaPct,
      goalsTnaPct: settings.goalsTnaPct,
      trigger: opts.trigger,
    },
  });

  let totalPaid = D(0);
  const paidUsers = new Set<string>();

  /* ------------------------- Saldo disponible ------------------------- */
  if (balanceTna > 0) {
    const wallets = await prisma.wallet.findMany({
      where: { user: { role: "STUDENT" }, balance: { gte: minBalance } },
      select: { userId: true, balance: true },
    });

    for (const w of wallets) {
      const base = Number(w.balance);
      const interest = simpleInterest(base, balanceTna, days);
      if (interest <= 0) continue;

      await payInterest({
        userId: w.userId,
        runId: run.id,
        source: "BALANCE",
        base,
        tnaPct: balanceTna,
        days,
        interest,
        description: `Interés de tu saldo (${balanceTna}% TNA)`,
        creditTo: "wallet",
        now,
      });

      totalPaid = totalPaid.plus(D(interest));
      paidUsers.add(w.userId);
    }
  }

  /* ------------------------- Metas de ahorro -------------------------- */
  if (goalsTna > 0) {
    const goals = await prisma.savingsGoal.findMany({
      where: {
        status: { not: "ARCHIVED" },
        savedAmount: { gt: 0 },
        user: { role: "STUDENT" },
      },
      select: { id: true, userId: true, name: true, savedAmount: true },
    });

    for (const g of goals) {
      const base = Number(g.savedAmount);
      const interest = simpleInterest(base, goalsTna, days);
      if (interest <= 0) continue;

      await payInterest({
        userId: g.userId,
        runId: run.id,
        source: "GOAL",
        base,
        tnaPct: goalsTna,
        days,
        interest,
        description: `Interés de tu meta "${g.name}" (${goalsTna}% TNA)`,
        creditTo: "goal",
        goalId: g.id,
        now,
      });

      totalPaid = totalPaid.plus(D(interest));
      paidUsers.add(g.userId);
    }
  }

  /* ------------------------- Aviso a cada alumno ---------------------- */
  if (paidUsers.size > 0) {
    const totals = await prisma.interestAccrual.groupBy({
      by: ["userId"],
      where: { runId: run.id },
      _sum: { interest: true },
    });
    await prisma.notification.createMany({
      data: totals.map((t) => ({
        userId: t.userId,
        type: "INTEREST_PAID" as const,
        title: "¡Ganaste intereses!",
        body:
          `Se acreditaron ${formatMoney(Number(t._sum.interest ?? 0))} por ` +
          `${days} día(s) de rendimiento. Mirá el detalle en Rendimientos.`,
      })),
    });
  }

  const finished = await prisma.interestRun.update({
    where: { id: run.id },
    data: { totalPaid, walletsCount: paidUsers.size },
  });

  return {
    ok: true,
    runId: run.id,
    days,
    totalPaid: Number(finished.totalPaid),
    walletsCount: finished.walletsCount,
  };
}

/**
 * Acredita un interés puntual: mueve el dinero, deja la transacción y guarda
 * el detalle del cálculo para poder mostrarle la fórmula al alumno.
 * El interés lo **emite el banco** (senderId null), igual que el plazo fijo.
 */
async function payInterest(args: {
  userId: string;
  runId: string;
  source: "BALANCE" | "GOAL";
  base: number;
  tnaPct: number;
  days: number;
  interest: number;
  description: string;
  creditTo: "wallet" | "goal";
  goalId?: string;
  now: Date;
}) {
  const amount = D(args.interest);

  await prisma.$transaction(async (tx) => {
    if (args.creditTo === "wallet") {
      await tx.wallet.update({
        where: { userId: args.userId },
        data: { balance: { increment: amount }, lastAccrualAt: args.now },
      });
    } else if (args.goalId) {
      await tx.savingsGoal.update({
        where: { id: args.goalId },
        data: {
          savedAmount: { increment: amount },
          earnedInterest: { increment: amount },
          lastAccrualAt: args.now,
        },
      });
    }

    const transaction = await tx.transaction.create({
      data: {
        type: "INTEREST",
        amount,
        description: args.description,
        category: "Ahorro",
        senderId: null,
        receiverId: args.userId,
      },
    });

    await tx.interestAccrual.create({
      data: {
        source: args.source,
        base: D(args.base),
        tnaPct: D(args.tnaPct),
        days: args.days,
        interest: amount,
        userId: args.userId,
        runId: args.runId,
        transactionId: transaction.id,
      },
    });
  });
}

/** Texto listo para mostrar de cómo se calculó un interés ya acreditado. */
export function accrualFormula(a: {
  base: Prisma.Decimal | number;
  tnaPct: Prisma.Decimal | number;
  days: number;
}) {
  return formatFormula(Number(a.base), Number(a.tnaPct), a.days);
}
