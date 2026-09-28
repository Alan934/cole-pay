import { round2 } from "@/lib/interest";

/**
 * Cheques de ColePay.
 *
 * El cheque de verdad es el papel de la chequera: el alumno lo llena a mano y
 * se lo entrega a otro alumno. Lo que vive en la app es el espejo de ese papel
 * —igual que pasa con la tarjeta de crédito—, y sirve para tres cosas: que el
 * cajero pueda verificar que el cheque existe y está a nombre de quien lo
 * presenta, que la plata se mueva recién cuando se cobra, y que el rechazo por
 * falta de fondos quede registrado.
 *
 * Nada de esto toca Prisma, así que las mismas funciones se usan en el
 * servidor y en el navegador.
 */

/** Nombre legible de cada estado. */
export const CHEQUE_STATUS_LABELS: Record<string, string> = {
  ISSUED: "En circulación",
  PAID: "Cobrado",
  BOUNCED: "Rechazado",
  CANCELLED: "Anulado",
};

/** Tono de badge de cada estado, para pintarlos igual en todas las pantallas. */
export const CHEQUE_STATUS_TONES: Record<
  string,
  "accent" | "success" | "danger" | "neutral" | "warning"
> = {
  ISSUED: "accent",
  PAID: "success",
  BOUNCED: "danger",
  CANCELLED: "neutral",
};

/** Formato del número impreso en la chequera: entre 4 y 12 dígitos. */
export const CHEQUE_NUMBER_RE = /^\d{4,12}$/;

/** Normaliza lo que se tipeó del papel: saca espacios y guiones. */
export function normalizeChequeNumber(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

/** Deja el número en bloques de 4 para leerlo de un vistazo: 0001 2345. */
export function formatChequeNumber(number: string): string {
  return number.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

/** Arranca el día a las 00:00, que es la unidad con la que se piensa una fecha de pago. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Lee lo que manda un `<input type="date">`.
 *
 * `new Date("2026-09-09")` se interpreta como medianoche **UTC**, así que en
 * Argentina (UTC-3) cae a las 21:00 del día anterior y la fecha se corre un
 * día. Por eso el formato AAAA-MM-DD se arma a mano con la hora local.
 */
export function parseDateInput(raw: string): Date {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (iso)
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 0, 0, 0, 0);
  return startOfDay(new Date(raw));
}

type ChequeDates = { issuedAt: Date | string; payableAt: Date | string };

/**
 * Un cheque es **diferido** cuando la fecha de pago cae después del día en que
 * se libró: el beneficiario lo tiene en la mano pero no lo puede cobrar
 * todavía. Es la forma más simple de que se vea que la plata tiene precio en
 * el tiempo.
 */
export function isDeferred(cheque: ChequeDates): boolean {
  return (
    startOfDay(new Date(cheque.payableAt)).getTime() >
    startOfDay(new Date(cheque.issuedAt)).getTime()
  );
}

/** Días que faltan para poder cobrarlo (0 si ya se puede). */
export function daysUntilPayable(
  payableAt: Date | string,
  now: Date = new Date(),
): number {
  const diff = startOfDay(new Date(payableAt)).getTime() - startOfDay(now).getTime();
  return diff <= 0 ? 0 : Math.ceil(diff / 86_400_000);
}

/** ¿Ya se puede presentar en la ventanilla? */
export function isPayable(
  cheque: { status: string; payableAt: Date | string },
  now: Date = new Date(),
): boolean {
  return (
    cheque.status === "ISSUED" && daysUntilPayable(cheque.payableAt, now) === 0
  );
}

/**
 * Comisión que se queda el banco por hacer efectivo el cheque. Se descuenta de
 * lo que cobra el beneficiario: el librador paga el importe completo.
 */
export function chequeFee(amount: number, feePct: number): number {
  if (amount <= 0 || feePct <= 0) return 0;
  return round2((amount * feePct) / 100);
}

/** Lo que termina recibiendo el beneficiario, ya descontada la comisión. */
export function chequeNetAmount(amount: number, feePct: number): number {
  return round2(amount - chequeFee(amount, feePct));
}
