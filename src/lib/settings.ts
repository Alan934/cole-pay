import { prisma } from "@/lib/prisma";

/** La configuración económica es una fila única. */
export const SETTINGS_ID = "singleton";

export type BankSettingsView = {
  interestEnabled: boolean;
  balanceTnaPct: number;
  goalsTnaPct: number;
  goalsLockDays: number;
  minBalanceToEarn: number;
  lastAccrualAt: Date | null;
  inflationEnabled: boolean;
  monthlyInflationPct: number;
  priceIndex: number;
  lastInflationAt: Date | null;
};

/** Devuelve la configuración del banco, creándola con valores neutros si falta. */
export async function getSettings() {
  const found = await prisma.bankSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (found) return found;
  return prisma.bankSettings.create({ data: { id: SETTINGS_ID } });
}

/** Versión con números planos, lista para pasar a componentes de cliente. */
export async function getSettingsView(): Promise<BankSettingsView> {
  const s = await getSettings();
  return {
    interestEnabled: s.interestEnabled,
    balanceTnaPct: Number(s.balanceTnaPct),
    goalsTnaPct: Number(s.goalsTnaPct),
    goalsLockDays: s.goalsLockDays,
    minBalanceToEarn: Number(s.minBalanceToEarn),
    lastAccrualAt: s.lastAccrualAt,
    inflationEnabled: s.inflationEnabled,
    monthlyInflationPct: Number(s.monthlyInflationPct),
    priceIndex: Number(s.priceIndex),
    lastInflationAt: s.lastInflationAt,
  };
}

/**
 * Plazos que ofrece el **Banco Central** (los que administra la profe). Los
 * bancos de quinto tienen su propia pizarra: ver `getBankTerms`.
 */
export async function getActiveTerms() {
  return prisma.depositTerm.findMany({
    where: { active: true, bankId: null },
    orderBy: { days: "asc" },
  });
}

/** Pizarra de tasas de un banco de quinto, del plazo más corto al más largo. */
export async function getBankTerms(bankId: string, onlyActive = true) {
  return prisma.depositTerm.findMany({
    where: { bankId, ...(onlyActive ? { active: true } : {}) },
    orderBy: { days: "asc" },
  });
}

/**
 * Las ofertas de plazo fijo vigentes de los bancos donde el alumno es cliente,
 * banco por banco, para que compare antes de elegir dónde poner la plata. El
 * banco principal (el primero al que se adhirió) va primero.
 */
export async function getDepositOffers(studentId: string) {
  const banks = await prisma.bank.findMany({
    where: {
      active: true,
      depositTerms: { some: { active: true } },
      memberships: { some: { studentId, endedAt: null } },
    },
    select: {
      id: true,
      name: true,
      color: true,
      depositTerms: {
        where: { active: true },
        orderBy: { days: "asc" },
        select: { id: true, days: true, tnaPct: true },
      },
      memberships: {
        where: { studentId, endedAt: null },
        select: { adheredAt: true },
      },
    },
    orderBy: { name: "asc" },
  });
  return banks.sort(
    (a, b) =>
      a.memberships[0].adheredAt.getTime() -
      b.memberships[0].adheredAt.getTime(),
  );
}
