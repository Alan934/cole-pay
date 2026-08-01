import { prisma } from "@/lib/prisma";

/**
 * Cobros recurrentes de ColePay.
 *
 * Un `RecurringCharge` no es un cobro: es la **regla** que los fabrica. Cada
 * `intervalDays` genera una `Invoice` por cada alumno del grupo.
 *
 * Dos decisiones importantes:
 *
 * 1. **Sin deriva.** El próximo vencimiento se calcula desde el `nextRunAt`
 *    anterior, no desde "ahora". Si el alquiler vencía el lunes y la corrida
 *    ocurre el jueves, el siguiente sigue siendo el lunes que viene.
 * 2. **Sin acumulación.** Si se juntaron 3 períodos (vacaciones, grupo
 *    inactivo), se emite **una sola** factura y se saltean los atrasados. En un
 *    aula, tres alquileres de golpe funden a todo el curso y no enseñan nada.
 */

/** Tope de saltos al ponerse al día: corta cualquier bucle por dato corrupto. */
const MAX_CATCHUP_PERIODS = 500;

export type RecurringOutcome =
  | { ok: false; reason: string }
  | {
      ok: true;
      chargesRun: number;
      invoicesCreated: number;
      /** Períodos atrasados que se saltearon (no se emitieron). */
      periodsSkipped: number;
    };

/**
 * Avanza un vencimiento hasta que quede en el futuro, respetando la grilla
 * original. Devuelve además cuántos períodos quedaron sin emitir.
 */
export function advanceSchedule(
  from: Date,
  intervalDays: number,
  now: Date,
): { next: Date; skipped: number } {
  const step = Math.max(1, Math.floor(intervalDays));
  const next = new Date(from);
  let skipped = -1; // el primer avance es el período que sí se emite

  do {
    next.setDate(next.getDate() + step);
    skipped++;
  } while (next <= now && skipped < MAX_CATCHUP_PERIODS);

  return { next, skipped };
}

/**
 * Genera los cobros recurrentes vencidos.
 *
 * Es **idempotente**: cada cobro se reclama con un UPDATE condicional sobre su
 * propio `nextRunAt` antes de emitir nada, igual que hacen `accrueInterest` y
 * `applyInflation`. Si el cron reintenta, o el admin aprieta el botón dos
 * veces, el segundo intento no encuentra nada para reclamar.
 */
export async function runRecurring(opts: {
  trigger: "CRON" | "MANUAL";
  now?: Date;
}): Promise<RecurringOutcome> {
  const now = opts.now ?? new Date();

  const due = await prisma.recurringCharge.findMany({
    where: { active: true, nextRunAt: { lte: now }, groupId: { not: null } },
  });
  if (due.length === 0) {
    return { ok: false, reason: "No hay cobros recurrentes vencidos." };
  }

  let chargesRun = 0;
  let invoicesCreated = 0;
  let periodsSkipped = 0;

  for (const rc of due) {
    const { next, skipped } = advanceSchedule(rc.nextRunAt, rc.intervalDays, now);

    // Reclamo del período: solo avanza si nadie más lo movió mientras tanto.
    const claim = await prisma.recurringCharge.updateMany({
      where: { id: rc.id, nextRunAt: rc.nextRunAt, active: true },
      data: { lastRunAt: now, nextRunAt: next },
    });
    if (claim.count === 0) continue; // otra corrida se lo llevó

    const students = await prisma.user.findMany({
      where: { groupId: rc.groupId!, role: "STUDENT" },
      select: { id: true },
    });
    if (students.length === 0) {
      chargesRun++;
      periodsSkipped += skipped;
      continue; // grupo vacío: el período igual queda consumido
    }

    await prisma.$transaction(async (tx) => {
      for (const s of students) {
        await tx.invoice.create({
          data: {
            description: rc.description,
            amount: rc.amount,
            // Vence cuando llega el próximo cobro del mismo servicio.
            dueDate: next,
            studentId: s.id,
            createdById: rc.createdById,
            status: "PENDING",
          },
        });
        await tx.notification.create({
          data: {
            userId: s.id,
            type: "NEW_INVOICE",
            title: "Nueva cuenta por pagar",
            body: `${rc.description} — ${rc.amount.toString()}`,
          },
        });
      }
    });

    chargesRun++;
    invoicesCreated += students.length;
    periodsSkipped += skipped;
  }

  if (chargesRun === 0) {
    return { ok: false, reason: "Los cobros vencidos ya los generó otra corrida." };
  }

  return { ok: true, chargesRun, invoicesCreated, periodsSkipped };
}
