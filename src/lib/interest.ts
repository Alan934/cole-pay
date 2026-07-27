/**
 * Matemática de rendimientos de ColePay.
 *
 * Todo el sistema habla en **TNA** (Tasa Nominal Anual): el porcentaje que
 * ganarías en un año si no se reinvirtieran los intereses. Para un plazo más
 * corto se reparte proporcionalmente:
 *
 *     interés = capital × (TNA / 100) × (días / 365)
 *
 * Este módulo no toca la base ni Prisma a propósito: las mismas funciones se
 * usan en el servidor para acreditar y en el navegador para la calculadora,
 * así el alumno ve exactamente los números que después le llegan a la cuenta.
 */

/** Días que usa el banco para prorratear la TNA. */
export const DAYS_IN_YEAR = 365;

/** Redondea a 2 decimales (medio hacia arriba), como cualquier banco. */
export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Interés simple de un capital a una TNA durante una cantidad de días.
 * Es la fórmula que se le muestra al alumno paso a paso.
 */
export function simpleInterest(
  principal: number,
  tnaPct: number,
  days: number,
): number {
  if (principal <= 0 || tnaPct <= 0 || days <= 0) return 0;
  return round2((principal * (tnaPct / 100) * days) / DAYS_IN_YEAR);
}

/** Tasa efectiva del período (lo que representa la TNA en esos días). */
export function periodRate(tnaPct: number, days: number): number {
  return (tnaPct * days) / DAYS_IN_YEAR;
}

/**
 * TEA (Tasa Efectiva Anual): lo que realmente ganás en un año cuando los
 * intereses se acreditan todos los días y **pasan a generar más interés**.
 * Siempre es mayor que la TNA: esa diferencia es el interés compuesto.
 */
export function tnaToTea(tnaPct: number): number {
  if (tnaPct <= 0) return 0;
  const daily = tnaPct / 100 / DAYS_IN_YEAR;
  return round2((Math.pow(1 + daily, DAYS_IN_YEAR) - 1) * 100);
}

/** Inflación anual equivalente a una inflación mensual dada. */
export function monthlyToAnnualInflation(monthlyPct: number): number {
  if (monthlyPct <= 0) return 0;
  return round2((Math.pow(1 + monthlyPct / 100, 12) - 1) * 100);
}

/**
 * Tasa real: cuánto ganás de verdad una vez descontada la inflación.
 * Usa la fórmula de Fisher, no una simple resta:
 *     (1 + tasa) / (1 + inflación) − 1
 * Si da negativo, tenés más plata pero comprás menos cosas.
 */
export function realRate(tnaPct: number, annualInflationPct: number): number {
  const r = tnaPct / 100;
  const i = annualInflationPct / 100;
  if (i <= -1) return 0;
  return round2(((1 + r) / (1 + i) - 1) * 100);
}

/**
 * Cuánto vale un capital después de N días si el interés se acredita todos
 * los días y se reinvierte (así funciona el saldo disponible de ColePay).
 */
export function compoundValue(
  principal: number,
  tnaPct: number,
  days: number,
): number {
  if (principal <= 0 || days <= 0) return round2(principal);
  const daily = tnaPct / 100 / DAYS_IN_YEAR;
  return round2(principal * Math.pow(1 + daily, days));
}

/** Serie día a día para graficar la evolución de un capital. */
export function compoundSeries(
  principal: number,
  tnaPct: number,
  days: number,
  points = 24,
): { day: number; value: number }[] {
  const total = Math.max(1, Math.round(days));
  const step = Math.max(1, Math.round(total / points));
  const out: { day: number; value: number }[] = [];
  for (let d = 0; d <= total; d += step) {
    out.push({ day: d, value: compoundValue(principal, tnaPct, d) });
  }
  if (out[out.length - 1].day !== total) {
    out.push({ day: total, value: compoundValue(principal, tnaPct, total) });
  }
  return out;
}

/** Días entre dos fechas (con decimales, sin redondear). */
export function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 86_400_000;
}

/** Días enteros completos entre dos fechas. Nunca negativo. */
export function wholeDaysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor(daysBetween(from, to)));
}

/** Suma días a una fecha sin mutar la original. */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

export type InterestBreakdown = {
  principal: number;
  tnaPct: number;
  days: number;
  /** Tasa que corresponde a esos días (TNA prorrateada). */
  periodRatePct: number;
  interest: number;
  total: number;
  /** La cuenta escrita con los números reales, para mostrársela al alumno. */
  formula: string;
};

/**
 * Arma el desglose completo de un cálculo de interés.
 * El campo `formula` es literalmente lo que el alumno tiene que saber hacer
 * en papel, con sus propios números reemplazados.
 */
export function breakdown(
  principal: number,
  tnaPct: number,
  days: number,
): InterestBreakdown {
  const interest = simpleInterest(principal, tnaPct, days);
  const nf = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return {
    principal,
    tnaPct,
    days,
    periodRatePct: round2(periodRate(tnaPct, days)),
    interest,
    total: round2(principal + interest),
    formula:
      `${nf.format(principal)} × (${tnaPct} ÷ 100) × (${days} ÷ ${DAYS_IN_YEAR}) ` +
      `= ${nf.format(interest)}`,
  };
}

/** Atajo: sólo la cuenta escrita, sin el resto del desglose. */
export function formatFormula(
  principal: number,
  tnaPct: number,
  days: number,
): string {
  return breakdown(principal, tnaPct, days).formula;
}
