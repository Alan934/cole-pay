/**
 * Reglas del préstamo.
 *
 * A propósito usamos **interés simple** sobre el capital, no sistema francés:
 * total = capital × (1 + tasa mensual × meses). Es la cuenta que los chicos
 * pueden rehacer a mano en el pizarrón, que es de lo que se trata la materia.
 *
 * Este módulo trabaja con `number` y no con `Prisma.Decimal` para poder usar
 * las mismas fórmulas en el navegador: así el alumno ve la cuota actualizarse
 * mientras mueve el monto, y el servidor guarda exactamente lo mismo.
 */

/** Redondeo a dos decimales, como cualquier importe del sistema. */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type LoanQuote = {
  principal: number;
  monthlyRatePct: number;
  installments: number;
  /** Lo que se paga de más por devolverlo en cuotas. */
  interest: number;
  total: number;
  installmentAmount: number;
  /** La cuenta escrita, para mostrársela al alumno. */
  formula: string;
};

/** Cotiza un préstamo: cuánto termina devolviendo y en cuánto queda la cuota. */
export function quoteLoan(
  principal: number,
  monthlyRatePct: number,
  installments: number,
): LoanQuote {
  const cap = Number.isFinite(principal) ? Math.max(0, principal) : 0;
  const rate = Number.isFinite(monthlyRatePct) ? Math.max(0, monthlyRatePct) : 0;
  const n = Math.max(1, Math.trunc(installments || 1));

  const interest = round2((cap * rate * n) / 100);
  const total = round2(cap + interest);
  const installmentAmount = round2(total / n);

  return {
    principal: round2(cap),
    monthlyRatePct: rate,
    installments: n,
    interest,
    total,
    installmentAmount,
    formula: `${round2(cap)} × ${rate}% × ${n} meses = ${interest} de interés`,
  };
}

export type LoanProgress = {
  total: number;
  paid: number;
  /** Lo que todavía debe. */
  remaining: number;
  installmentAmount: number;
  installments: number;
  /** Cuotas cubiertas por lo que ya pagó. */
  paidInstallments: number;
  paidPct: number;
  /** Lo que le conviene pagar ahora: una cuota, o lo que quede si es menos. */
  nextPayment: number;
};

/** Cómo viene el alumno con la devolución. */
export function loanProgress(loan: {
  totalToRepay: number | null;
  paidAmount: number;
  installmentAmount: number | null;
  installments: number | null;
}): LoanProgress {
  const total = loan.totalToRepay ?? 0;
  const paid = loan.paidAmount;
  const installmentAmount = loan.installmentAmount ?? 0;
  const installments = loan.installments ?? 0;

  const remaining = round2(Math.max(total - paid, 0));
  const paidInstallments =
    installmentAmount > 0
      ? Math.min(installments, Math.floor(paid / installmentAmount))
      : 0;

  return {
    total,
    paid,
    remaining,
    installmentAmount,
    installments,
    paidInstallments,
    paidPct: total > 0 ? Math.min(100, (paid / total) * 100) : 0,
    // La última cuota se lleva el resto: nunca ofrecemos pagar de más.
    nextPayment: round2(Math.min(installmentAmount, remaining)),
  };
}
