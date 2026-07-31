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

/** Plazos fijos ofrecidos actualmente, del más corto al más largo. */
export async function getActiveTerms() {
  return prisma.depositTerm.findMany({
    where: { active: true },
    orderBy: { days: "asc" },
  });
}
