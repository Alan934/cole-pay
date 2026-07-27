import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SETTINGS_ID, getSettings } from "@/lib/settings";
import { round2 } from "@/lib/interest";

/**
 * Inflación de ColePay.
 *
 * El admin fija una **inflación mensual**. A partir de ahí sube un índice de
 * precios (arranca en 100) y, con él, el monto de los cobros recurrentes:
 * el alquiler del stand, los servicios, etc.
 *
 * Sirve para que el alumno vea que tener más pesos no es lo mismo que poder
 * comprar más cosas: si la TNA le rinde menos que la inflación, en realidad
 * está perdiendo. Eso es la **tasa real**.
 */

/** Días que ColePay considera "un mes" para prorratear la inflación. */
export const DAYS_IN_MONTH = 30;

export type InflationOutcome =
  | { ok: false; reason: string }
  | {
      ok: true;
      appliedPct: number;
      priceIndex: number;
      chargesUpdated: number;
      days: number;
    };

/**
 * Factor de aumento de precios para una cantidad de días.
 * Es interés compuesto igual que el rendimiento, pero jugando en contra.
 */
export function inflationFactor(monthlyPct: number, days: number): number {
  if (monthlyPct <= 0 || days <= 0) return 1;
  return Math.pow(1 + monthlyPct / 100, days / DAYS_IN_MONTH);
}

/**
 * Aplica el ajuste de precios. Idempotente frente al cron: reclama el período
 * con un UPDATE condicional antes de tocar ningún monto.
 */
export async function applyInflation(opts: {
  trigger: "CRON" | "MANUAL";
  days?: number;
  now?: Date;
}): Promise<InflationOutcome> {
  const now = opts.now ?? new Date();
  const settings = await getSettings();

  if (!settings.inflationEnabled) {
    return { ok: false, reason: "La inflación está desactivada." };
  }
  const monthly = Number(settings.monthlyInflationPct);
  if (monthly <= 0) {
    return { ok: false, reason: "La inflación mensual está en 0%." };
  }

  // Una corrida manual aplica un mes entero de una (para verlo en clase);
  // el cron aplica la parte proporcional de los días transcurridos.
  const days = opts.days ?? (opts.trigger === "MANUAL" ? DAYS_IN_MONTH : 1);
  if (days <= 0) return { ok: false, reason: "No hay días para ajustar." };

  const claim = await prisma.bankSettings.updateMany({
    where:
      opts.trigger === "CRON"
        ? {
            id: SETTINGS_ID,
            OR: [
              { lastInflationAt: null },
              { lastInflationAt: { lte: new Date(now.getTime() - 86_400_000) } },
            ],
          }
        : { id: SETTINGS_ID },
    data: { lastInflationAt: now },
  });
  if (claim.count === 0) {
    return { ok: false, reason: "Los precios de este período ya se ajustaron." };
  }

  const factor = inflationFactor(monthly, days);
  const appliedPct = round2((factor - 1) * 100);

  const newIndex = new Prisma.Decimal(
    Number(settings.priceIndex) * factor,
  ).toDecimalPlaces(4);

  // Los cobros recurrentes activos siguen al índice de precios.
  const charges = await prisma.recurringCharge.findMany({
    where: { active: true },
    select: { id: true, amount: true },
  });

  let chargesUpdated = 0;
  for (const c of charges) {
    const updated = new Prisma.Decimal(Number(c.amount) * factor).toDecimalPlaces(
      2,
    );
    if (updated.equals(c.amount)) continue;
    await prisma.recurringCharge.update({
      where: { id: c.id },
      data: { amount: updated },
    });
    chargesUpdated++;
  }

  await prisma.bankSettings.update({
    where: { id: SETTINGS_ID },
    data: { priceIndex: newIndex },
  });

  return {
    ok: true,
    appliedPct,
    priceIndex: Number(newIndex),
    chargesUpdated,
    days,
  };
}
