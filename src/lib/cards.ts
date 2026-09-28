import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Reglas de la tarjeta de crédito.
 *
 * La idea es que se parezca a una tarjeta real: el alumno consume ahora, el
 * banco le paga al comercio en el acto y el alumno le queda debiendo al banco.
 * Cada tanto el banco cierra el período: junta los consumos en un resumen, le
 * suma el interés del saldo que quedó financiado y le pone una fecha de
 * vencimiento. Si el alumno no paga todo, el resto pasa al resumen siguiente
 * con más interés.
 */

const D = (v: number | string | Prisma.Decimal) => new Prisma.Decimal(v);

export const CARD_BRANDS = ["VISA", "MASTERCARD", "COLEPAY"] as const;
export type CardBrandName = (typeof CARD_BRANDS)[number];

/** Primer dígito característico de cada marca, como en las tarjetas reales. */
const BRAND_PREFIX: Record<CardBrandName, string> = {
  VISA: "4",
  MASTERCARD: "5",
  COLEPAY: "9",
};

export const CARD_BRAND_LABELS: Record<CardBrandName, string> = {
  VISA: "Visa",
  MASTERCARD: "Mastercard",
  COLEPAY: "ColePay",
};

/* ------------------------------ Número y datos ----------------------------- */

/** Dígito verificador de Luhn, el mismo algoritmo que usan las tarjetas reales. */
function luhnCheckDigit(partial: string): number {
  let sum = 0;
  // Se recorre de derecha a izquierda; el primero ya cuenta como posición par.
  let double = true;
  for (let i = partial.length - 1; i >= 0; i--) {
    let d = Number(partial[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return (10 - (sum % 10)) % 10;
}

/** ¿El número pasa la validación de Luhn? */
export function luhnValid(number: string): boolean {
  const digits = number.replace(/\D/g, "");
  if (digits.length !== 16) return false;
  return luhnCheckDigit(digits.slice(0, 15)) === Number(digits[15]);
}

/** Genera un número de 16 dígitos válido para la marca indicada. */
export function generateCardNumber(brand: CardBrandName): string {
  let partial = BRAND_PREFIX[brand];
  while (partial.length < 15) partial += Math.floor(Math.random() * 10);
  return partial + luhnCheckDigit(partial);
}

/** Número que no choque con ninguno ya emitido. */
export async function generateUniqueCardNumber(
  brand: CardBrandName,
): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const number = generateCardNumber(brand);
    const taken = await prisma.creditCard.findUnique({
      where: { number },
      select: { id: true },
    });
    if (!taken) return number;
  }
  throw new Error("No se pudo generar un número de tarjeta libre.");
}

/** Código de seguridad ficticio de 3 dígitos. */
export function generateCvv(): string {
  return String(Math.floor(Math.random() * 1000)).padStart(3, "0");
}

/** Vencimiento por defecto: tres años desde hoy. */
export function defaultExpiry(from = new Date()) {
  return { expMonth: from.getMonth() + 1, expYear: from.getFullYear() + 3 };
}

/** "4539 1488 0343 6467" */
export function formatCardNumber(number: string): string {
  return number.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** "•••• •••• •••• 6467" */
export function maskCardNumber(last4: string): string {
  return `•••• •••• •••• ${last4}`;
}

/** "09/29" */
export function formatExpiry(expMonth: number, expYear: number): string {
  return `${String(expMonth).padStart(2, "0")}/${String(expYear).slice(-2)}`;
}

/** Una tarjeta vence al terminar el mes impreso en el plástico. */
export function isExpired(
  card: { expMonth: number; expYear: number },
  now = new Date(),
): boolean {
  // Día 0 del mes siguiente = último día del mes de vencimiento.
  const end = new Date(card.expYear, card.expMonth, 1);
  return now >= end;
}

/* --------------------------------- Fechas --------------------------------- */

/** Fecha del mes pedido, recortando el día si ese mes es más corto. */
function atMonthDay(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay), 23, 59, 59, 999);
}

/** Primer cierre posterior a `from`, según el día de cierre de la tarjeta. */
export function nextClosingDate(from: Date, closingDay: number): Date {
  const candidate = atMonthDay(from.getFullYear(), from.getMonth(), closingDay);
  if (candidate > from) return candidate;
  return atMonthDay(from.getFullYear(), from.getMonth() + 1, closingDay);
}

/** Vencimiento del resumen: tantos días después del cierre. */
export function dueDateFrom(periodEnd: Date, dueDays: number): Date {
  const d = new Date(periodEnd);
  d.setDate(d.getDate() + dueDays);
  d.setHours(23, 59, 59, 999);
  return d;
}

/* ------------------------------ Estado de deuda ---------------------------- */

/** Estado de cuenta de una tarjeta, tal como se lo mostramos al alumno. */
export type CardBalance = {
  /** Consumos del período que todavía no entró en ningún resumen. */
  currentPeriod: number;
  /** Resúmenes cerrados que siguen impagos (lo que ya se puede pagar). */
  billed: number;
  /** Todo lo que le debe al banco. */
  debt: number;
  limit: number;
  available: number;
  usedPct: number;
};

type BalanceInput = {
  creditLimit: Prisma.Decimal | number | string;
  charges?: { amount: Prisma.Decimal | number | string; statementId: string | null }[];
  statements?: {
    status: string;
    total: Prisma.Decimal | number | string;
    paid: Prisma.Decimal | number | string;
  }[];
};

/**
 * Calcula la deuda a partir de los cargos y resúmenes ya cargados.
 * Los resúmenes ROLLED y PAID no cuentan: su saldo ya viajó al resumen
 * siguiente o fue cancelado.
 */
export function cardBalance(card: BalanceInput): CardBalance {
  const currentPeriod = (card.charges ?? [])
    .filter((c) => c.statementId === null)
    .reduce((acc, c) => acc.plus(D(c.amount)), D(0));

  const billed = (card.statements ?? [])
    .filter((s) => s.status === "CLOSED" || s.status === "OVERDUE")
    .reduce((acc, s) => acc.plus(D(s.total).minus(D(s.paid))), D(0));

  const debt = currentPeriod.plus(billed);
  const limit = D(card.creditLimit);
  const available = Prisma.Decimal.max(limit.minus(debt), D(0));

  return {
    currentPeriod: currentPeriod.toNumber(),
    billed: billed.toNumber(),
    debt: debt.toNumber(),
    limit: limit.toNumber(),
    available: available.toNumber(),
    usedPct: limit.isZero()
      ? 0
      : Math.min(100, debt.dividedBy(limit).times(100).toNumber()),
  };
}

/** Consulta la deuda de una tarjeta directamente contra la base. */
export async function fetchCardBalance(cardId: string): Promise<CardBalance> {
  const card = await prisma.creditCard.findUniqueOrThrow({
    where: { id: cardId },
    select: {
      creditLimit: true,
      charges: { where: { statementId: null }, select: { amount: true, statementId: true } },
      statements: {
        where: { status: { in: ["CLOSED", "OVERDUE"] } },
        select: { status: true, total: true, paid: true },
      },
    },
  });
  return cardBalance(card);
}

/* ------------------------------ Cierre de mes ------------------------------ */

export type CloseResult = {
  closed: number;
  statements: { cardId: string; total: number }[];
  skipped: number;
};

type CloseOptions = {
  /** Limitar el cierre a estas tarjetas (lo usa el botón del banco). */
  cardIds?: string[];
  /**
   * `true` cierra el período aunque todavía no haya llegado la fecha de cierre.
   * Es lo que hace el banco cuando quiere facturar en el momento.
   */
  force?: boolean;
  now?: Date;
};

/**
 * Cierra los períodos que correspondan y emite el resumen de cada tarjeta.
 *
 * Es idempotente: cada tarjeta sólo se cierra si pasó su fecha de cierre (o si
 * el banco lo fuerza), y al cerrar se guarda `lastClosedAt`, así que correrlo
 * dos veces el mismo día no factura dos veces.
 */
export async function closeStatements(
  opts: CloseOptions = {},
): Promise<CloseResult> {
  const now = opts.now ?? new Date();
  const cards = await prisma.creditCard.findMany({
    where: {
      status: { in: ["ACTIVE", "BLOCKED"] },
      ...(opts.cardIds ? { id: { in: opts.cardIds } } : {}),
    },
    select: {
      id: true,
      ownerId: true,
      issuedAt: true,
      lastClosedAt: true,
      closingDay: true,
      dueDays: true,
      monthlyRatePct: true,
      last4: true,
      bank: { select: { name: true } },
    },
  });

  const result: CloseResult = { closed: 0, statements: [], skipped: 0 };

  for (const card of cards) {
    const periodStart = card.lastClosedAt ?? card.issuedAt;
    const scheduled = nextClosingDate(periodStart, card.closingDay);

    if (!opts.force && scheduled > now) {
      result.skipped++;
      continue;
    }
    // Al forzar, el período termina hoy; si no, en la fecha de cierre pactada.
    const periodEnd = opts.force ? now : scheduled;

    const statement = await prisma.$transaction(async (tx) => {
      const charges = await tx.cardCharge.findMany({
        where: { cardId: card.id, statementId: null, createdAt: { lte: periodEnd } },
        select: { id: true, amount: true },
      });
      const pending = await tx.cardStatement.findMany({
        where: { cardId: card.id, status: { in: ["CLOSED", "OVERDUE"] } },
        select: { id: true, total: true, paid: true },
      });

      const chargesTotal = charges.reduce((acc, c) => acc.plus(c.amount), D(0));
      const previousBalance = pending.reduce(
        (acc, s) => acc.plus(D(s.total).minus(D(s.paid))),
        D(0),
      );

      // Nada que facturar: se corre el período sin emitir un resumen vacío.
      if (chargesTotal.isZero() && previousBalance.isZero()) {
        await tx.creditCard.update({
          where: { id: card.id },
          data: { lastClosedAt: periodEnd },
        });
        return null;
      }

      // El interés se cobra sólo sobre lo que quedó financiado del resumen
      // anterior: si el mes pasado pagó todo, este mes no paga interés.
      const interest = previousBalance
        .times(D(card.monthlyRatePct))
        .dividedBy(100)
        .toDecimalPlaces(2);
      const total = previousBalance.plus(interest).plus(chargesTotal);
      const dueDate = dueDateFrom(periodEnd, card.dueDays);

      const created = await tx.cardStatement.create({
        data: {
          cardId: card.id,
          periodStart,
          periodEnd,
          dueDate,
          status: "CLOSED",
          previousBalance,
          chargesTotal,
          interest,
          total,
        },
      });

      if (charges.length > 0) {
        await tx.cardCharge.updateMany({
          where: { id: { in: charges.map((c) => c.id) } },
          data: { statementId: created.id },
        });
      }
      if (interest.greaterThan(0)) {
        await tx.cardCharge.create({
          data: {
            cardId: card.id,
            statementId: created.id,
            kind: "INTEREST",
            amount: interest,
            description: `Interés por saldo financiado (${card.monthlyRatePct}% mensual)`,
          },
        });
      }
      // Los resúmenes viejos ya no se cobran por separado: su saldo impago
      // quedó incluido acá arriba como "saldo anterior".
      if (pending.length > 0) {
        await tx.cardStatement.updateMany({
          where: { id: { in: pending.map((s) => s.id) } },
          data: { status: "ROLLED" },
        });
      }

      await tx.creditCard.update({
        where: { id: card.id },
        data: { lastClosedAt: periodEnd },
      });

      await tx.notification.create({
        data: {
          userId: card.ownerId,
          type: "STATEMENT_CLOSED",
          title: "Cerró el resumen de tu tarjeta",
          body: `${card.bank.name} cerró el resumen de tu tarjeta ••••${card.last4}: ${total.toFixed(2)}. Vence el ${dueDate.toLocaleDateString("es-AR")}.`,
        },
      });

      return created;
    });

    if (statement) {
      result.closed++;
      result.statements.push({
        cardId: card.id,
        total: Number(statement.total),
      });
    } else {
      result.skipped++;
    }
  }

  return result;
}

/**
 * Marca como vencidos los resúmenes que pasaron su fecha de vencimiento sin
 * pagarse del todo, y avisa al alumno. El interés se cobra recién en el
 * próximo cierre, igual que en un resumen real.
 */
export async function markOverdueStatements(now = new Date()): Promise<number> {
  const due = await prisma.cardStatement.findMany({
    where: { status: "CLOSED", dueDate: { lt: now } },
    select: {
      id: true,
      total: true,
      paid: true,
      card: { select: { ownerId: true, last4: true } },
    },
  });

  let count = 0;
  for (const s of due) {
    if (D(s.total).lessThanOrEqualTo(D(s.paid))) continue;
    await prisma.$transaction([
      prisma.cardStatement.update({
        where: { id: s.id },
        data: { status: "OVERDUE" },
      }),
      prisma.notification.create({
        data: {
          userId: s.card.ownerId,
          type: "STATEMENT_DUE",
          title: "Se venció el resumen de tu tarjeta",
          body: `Quedaron ${D(s.total).minus(D(s.paid)).toFixed(2)} sin pagar de tu tarjeta ••••${s.card.last4}. En el próximo cierre se te cobra interés.`,
        },
      }),
    ]);
    count++;
  }
  return count;
}

/** Corrida diaria de tarjetas: primero se marcan las moras, después se cierra. */
export async function runCardCycle(now = new Date()) {
  const overdue = await markOverdueStatements(now);
  const closing = await closeStatements({ now });
  return { overdue, ...closing };
}

/**
 * Tarjetas con las que el alumno puede pagar ahora mismo: activas, sin vencer
 * y con su límite disponible ya calculado. Lo usa la pantalla de pago.
 */
export async function getPayableCards(userId: string) {
  const cards = await prisma.creditCard.findMany({
    where: { ownerId: userId, status: "ACTIVE" },
    include: {
      bank: { select: { name: true } },
      charges: {
        where: { statementId: null },
        select: { amount: true, statementId: true },
      },
      statements: {
        where: { status: { in: ["CLOSED", "OVERDUE"] } },
        select: { status: true, total: true, paid: true },
      },
    },
    orderBy: { issuedAt: "desc" },
  });

  return cards
    .filter((c) => !isExpired(c))
    .map((c) => ({
      id: c.id,
      brandLabel: CARD_BRAND_LABELS[c.brand as CardBrandName],
      last4: c.last4,
      bankName: c.bank.name,
      available: cardBalance(c).available,
    }));
}
