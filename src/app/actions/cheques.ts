"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireBankStaff, requireStudent } from "@/lib/session";
import {
  bounceChequeSchema,
  chequeFeeSchema,
  chequeIdSchema,
  issueChequeSchema,
  registerChequeSchema,
} from "@/lib/validations";
import {
  chequeFee,
  daysUntilPayable,
  formatChequeNumber,
  parseDateInput,
  startOfDay,
} from "@/lib/cheques";
import { formatMoney } from "@/lib/utils";
import type { ActionResult } from "@/app/actions/student";

/**
 * Circuito del cheque.
 *
 * El cheque es papel: un alumno de tercero llena uno de su chequera y se lo da
 * a otro alumno de tercero. En la app queda el espejo de ese papel. Cuando el
 * beneficiario lo lleva al mostrador, el banco recién ahí mueve la plata:
 * debita al librador, se queda la comisión y le paga el resto.
 *
 * Lo importante para la clase es lo que pasa cuando el librador no tiene
 * fondos: el cheque **rebota**, no se mueve un peso y el rechazo le queda
 * anotado en el historial. Firmar un cheque no es lo mismo que tener la plata.
 */

const D = (v: number | string) => new Prisma.Decimal(v);

function revalidateCheques() {
  revalidatePath("/cheques");
  revalidatePath("/dashboard");
  revalidatePath("/activity");
  revalidatePath("/bank/cheques");
  revalidatePath("/bank");
  revalidatePath("/bank/account");
}

/**
 * Resuelve la fecha de pago. Vacía significa "a la vista": se cobra hoy. Con
 * fecha posterior es un cheque diferido.
 */
function resolvePayableAt(raw: string | undefined): Date | "PASADO" {
  const today = startOfDay(new Date());
  if (!raw) return today;
  const parsed = parseDateInput(raw);
  if (parsed.getTime() < today.getTime()) return "PASADO";
  return parsed;
}

/** Validaciones comunes del alta, contra la base. */
async function prepareCheque(input: {
  number: string;
  drawerId: string;
  payeeId: string;
  payableAt: string | undefined;
}): Promise<{ ok: false; error: string } | { ok: true; payableAt: Date }> {
  if (input.drawerId === input.payeeId)
    return { ok: false, error: "No podés hacerte un cheque a vos mismo." };

  const payableAt = resolvePayableAt(input.payableAt);
  if (payableAt === "PASADO")
    return { ok: false, error: "La fecha de pago no puede ser anterior a hoy." };

  const [payee, repeated] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.payeeId },
      select: { id: true, role: true },
    }),
    prisma.cheque.findUnique({
      where: { number: input.number },
      select: { id: true },
    }),
  ]);

  if (!payee || payee.role !== "STUDENT")
    return { ok: false, error: "El beneficiario no es un alumno válido." };
  if (repeated)
    return {
      ok: false,
      error: `El cheque ${formatChequeNumber(input.number)} ya está cargado.`,
    };

  return { ok: true, payableAt };
}

/* --------------------------------- Alumno --------------------------------- */

/**
 * El librador carga en la app el cheque que acaba de llenar en papel. No se le
 * descuenta nada todavía: la plata sale cuando el beneficiario lo cobra.
 */
export async function issueCheque(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const parsed = issueChequeSchema.safeParse({
    number: formData.get("number"),
    payeeId: formData.get("payeeId"),
    amount: formData.get("amount"),
    payableAt: formData.get("payableAt") || undefined,
    concept: formData.get("concept") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { number, payeeId, amount, payableAt, concept } = parsed.data;
  const prep = await prepareCheque({
    number,
    drawerId: me.id,
    payeeId,
    payableAt,
  });
  if (!prep.ok) return prep;

  const cheque = await prisma.cheque.create({
    data: {
      number,
      amount: D(amount),
      concept: concept?.trim() || null,
      payableAt: prep.payableAt,
      drawerId: me.id,
      payeeId,
      registeredById: me.id,
    },
    include: { payee: { select: { name: true } } },
  });

  const dias = daysUntilPayable(cheque.payableAt);
  await prisma.notification.create({
    data: {
      userId: payeeId,
      type: "GENERIC",
      title: "Te llegó un cheque",
      body:
        `${me.name} te libró el cheque ${formatChequeNumber(number)} por ` +
        `${formatMoney(amount)}. ` +
        (dias > 0
          ? `Lo vas a poder cobrar en ${dias} ${dias === 1 ? "día" : "días"}.`
          : "Ya lo podés ir a cobrar al banco."),
    },
  });

  revalidateCheques();
  return {
    ok: true,
    message:
      `Cheque ${formatChequeNumber(number)} a favor de ${cheque.payee.name} ` +
      `por ${formatMoney(amount)}. ` +
      (dias > 0
        ? `Es diferido: se puede cobrar en ${dias} ${dias === 1 ? "día" : "días"}.`
        : "Se puede cobrar desde hoy."),
  };
}

/** El librador anula un cheque que todavía no cobraron. */
export async function cancelCheque(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const parsed = chequeIdSchema.safeParse({
    chequeId: formData.get("chequeId"),
  });
  if (!parsed.success) return { ok: false, error: "Cheque inválido." };

  const cheque = await prisma.cheque.findUnique({
    where: { id: parsed.data.chequeId },
    select: { id: true, number: true, drawerId: true, status: true },
  });
  if (!cheque || cheque.drawerId !== me.id)
    return { ok: false, error: "No se encontró el cheque." };
  if (cheque.status !== "ISSUED")
    return {
      ok: false,
      error: "Sólo se puede anular un cheque que sigue en circulación.",
    };

  await prisma.cheque.update({
    where: { id: cheque.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  revalidateCheques();
  return {
    ok: true,
    message: `Cheque ${formatChequeNumber(cheque.number)} anulado.`,
  };
}

/* ------------------------------- Ventanilla -------------------------------- */

/**
 * El cajero da de alta un cheque que llegó en papel sin haber sido cargado.
 * Lo carga él y no el beneficiario a propósito: si el que cobra pudiera
 * inventar el cheque, no habría control ninguno.
 */
export async function registerChequeAtCounter(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireBankStaff();
  if (!me.bank) return { ok: false, error: "No estás asignado a un banco." };

  const parsed = registerChequeSchema.safeParse({
    number: formData.get("number"),
    drawerId: formData.get("drawerId"),
    payeeId: formData.get("payeeId"),
    amount: formData.get("amount"),
    payableAt: formData.get("payableAt") || undefined,
    concept: formData.get("concept") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { number, drawerId, payeeId, amount, payableAt, concept } = parsed.data;

  const drawer = await prisma.user.findUnique({
    where: { id: drawerId },
    select: { role: true },
  });
  if (!drawer || drawer.role !== "STUDENT")
    return { ok: false, error: "El librador no es un alumno válido." };

  const prep = await prepareCheque({ number, drawerId, payeeId, payableAt });
  if (!prep.ok) return prep;

  await prisma.cheque.create({
    data: {
      number,
      amount: D(amount),
      concept: concept?.trim() || null,
      payableAt: prep.payableAt,
      drawerId,
      payeeId,
      registeredById: me.id,
    },
  });

  revalidateCheques();
  return {
    ok: true,
    message: `Cheque ${formatChequeNumber(number)} cargado. Ya lo podés hacer efectivo.`,
  };
}

/**
 * El banco hace efectivo el cheque. Si el librador no tiene fondos, el cheque
 * rebota acá mismo: queda en BOUNCED y no se mueve un peso.
 */
export async function cashCheque(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireBankStaff();
  const bank = me.bank;
  if (!bank) return { ok: false, error: "No estás asignado a un banco." };

  const parsed = chequeIdSchema.safeParse({
    chequeId: formData.get("chequeId"),
  });
  if (!parsed.success) return { ok: false, error: "Cheque inválido." };

  const feePct = Number(bank.chequeFeePct);

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const cheque = await tx.cheque.findUnique({
        where: { id: parsed.data.chequeId },
        include: {
          drawer: { select: { id: true, name: true } },
          payee: { select: { id: true, name: true } },
        },
      });
      if (!cheque) throw new Error("NO_ENCONTRADO");
      if (cheque.status !== "ISSUED") throw new Error("YA_USADO");
      if (daysUntilPayable(cheque.payableAt) > 0) throw new Error("DIFERIDO");

      const amount = Number(cheque.amount);
      const drawerWallet = await tx.wallet.findUnique({
        where: { userId: cheque.drawerId },
      });

      // Sin fondos no hay cobro: el cheque rebota y queda la marca.
      if (!drawerWallet || drawerWallet.balance.lessThan(cheque.amount)) {
        await tx.cheque.update({
          where: { id: cheque.id },
          data: {
            status: "BOUNCED",
            bouncedAt: new Date(),
            bounceReason: "Sin fondos suficientes",
            bankId: bank.id,
            paidById: me.id,
          },
        });
        await tx.notification.createMany({
          data: [
            {
              userId: cheque.drawerId,
              type: "GENERIC" as const,
              title: "Tu cheque rebotó",
              body:
                `${bank.name} rechazó el cheque ${formatChequeNumber(cheque.number)} ` +
                `por ${formatMoney(amount)}: no tenías saldo suficiente.`,
            },
            {
              userId: cheque.payeeId,
              type: "GENERIC" as const,
              title: "El cheque no tenía fondos",
              body:
                `El cheque ${formatChequeNumber(cheque.number)} de ` +
                `${cheque.drawer.name} fue rechazado por falta de fondos.`,
            },
          ],
        });
        return { bounced: true as const, cheque, amount };
      }

      const fee = chequeFee(amount, feePct);
      const net = amount - fee;

      await tx.wallet.update({
        where: { userId: cheque.drawerId },
        data: { balance: { decrement: cheque.amount } },
      });
      await tx.wallet.update({
        where: { userId: cheque.payeeId },
        data: { balance: { increment: D(net) } },
      });

      const movement = await tx.transaction.create({
        data: {
          type: "CHEQUE_PAYMENT",
          amount: D(net),
          description: `Cheque ${formatChequeNumber(cheque.number)} cobrado en ${bank.name}`,
          category: "Cheques",
          senderId: cheque.drawerId,
          receiverId: cheque.payeeId,
          bankId: bank.id,
        },
      });

      // La comisión sale del importe del cheque: el librador paga el total y
      // el beneficiario cobra el neto.
      if (fee > 0) {
        await tx.wallet.update({
          where: { userId: bank.accountId },
          data: { balance: { increment: D(fee) } },
        });
        await tx.transaction.create({
          data: {
            type: "CHEQUE_PAYMENT",
            amount: D(fee),
            description: `Comisión por cobrar el cheque ${formatChequeNumber(cheque.number)}`,
            category: "Comisiones",
            senderId: cheque.payeeId,
            receiverId: bank.accountId,
            bankId: bank.id,
          },
        });
      }

      await tx.cheque.update({
        where: { id: cheque.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          bankId: bank.id,
          paidById: me.id,
          fee: D(fee),
          transactionId: movement.id,
        },
      });

      await tx.notification.createMany({
        data: [
          {
            userId: cheque.payeeId,
            type: "MONEY_RECEIVED" as const,
            title: "Cobraste un cheque",
            body:
              `Cobraste ${formatMoney(net)} del cheque ` +
              `${formatChequeNumber(cheque.number)}` +
              (fee > 0 ? ` (${formatMoney(fee)} de comisión).` : "."),
          },
          {
            userId: cheque.drawerId,
            type: "GENERIC" as const,
            title: "Te cobraron un cheque",
            body:
              `${cheque.payee.name} cobró el cheque ` +
              `${formatChequeNumber(cheque.number)} por ${formatMoney(amount)}.`,
          },
        ],
      });

      return { bounced: false as const, cheque, amount, fee, net };
    });

    revalidateCheques();

    if (outcome.bounced) {
      return {
        ok: false,
        error:
          `Cheque rechazado: ${outcome.cheque.drawer.name} no tiene ` +
          `${formatMoney(outcome.amount)} en la cuenta. Quedó registrado como rebotado.`,
      };
    }

    return {
      ok: true,
      message:
        `Cheque ${formatChequeNumber(outcome.cheque.number)} pagado. ` +
        `${outcome.cheque.payee.name} se lleva ${formatMoney(outcome.net)}` +
        (outcome.fee > 0
          ? ` y el banco cobró ${formatMoney(outcome.fee)} de comisión.`
          : "."),
    };
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "NO_ENCONTRADO")
      return { ok: false, error: "No se encontró el cheque." };
    if (code === "YA_USADO")
      return { ok: false, error: "Ese cheque ya fue cobrado o anulado." };
    if (code === "DIFERIDO")
      return {
        ok: false,
        error: "El cheque es diferido: todavía no llegó la fecha de pago.",
      };
    return { ok: false, error: "No se pudo cobrar el cheque." };
  }
}

/**
 * Rechazo a mano: la firma no coincide, el papel está roto, la fecha está mal.
 * No mueve plata, sólo deja el motivo asentado.
 */
export async function rejectCheque(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireBankStaff();
  const bank = me.bank;
  if (!bank) return { ok: false, error: "No estás asignado a un banco." };

  const parsed = bounceChequeSchema.safeParse({
    chequeId: formData.get("chequeId"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const cheque = await prisma.cheque.findUnique({
    where: { id: parsed.data.chequeId },
    select: {
      id: true,
      number: true,
      status: true,
      drawerId: true,
      payeeId: true,
    },
  });
  if (!cheque) return { ok: false, error: "No se encontró el cheque." };
  if (cheque.status !== "ISSUED")
    return { ok: false, error: "Ese cheque ya fue cobrado o anulado." };

  const reason = parsed.data.reason?.trim() || "Rechazado en la ventanilla";

  await prisma.cheque.update({
    where: { id: cheque.id },
    data: {
      status: "BOUNCED",
      bouncedAt: new Date(),
      bounceReason: reason,
      bankId: bank.id,
      paidById: me.id,
    },
  });
  await prisma.notification.createMany({
    data: [cheque.drawerId, cheque.payeeId].map((userId) => ({
      userId,
      type: "GENERIC" as const,
      title: "Cheque rechazado",
      body: `${bank.name} rechazó el cheque ${formatChequeNumber(cheque.number)}: ${reason}.`,
    })),
  });

  revalidateCheques();
  return {
    ok: true,
    message: `Cheque ${formatChequeNumber(cheque.number)} rechazado.`,
  };
}

/** El mostrador fija cuánto cobra por hacer efectivo un cheque. */
export async function saveChequeFee(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireBankStaff();
  const bank = me.bank;
  if (!bank) return { ok: false, error: "No estás asignado a un banco." };

  const parsed = chequeFeeSchema.safeParse({
    chequeFeePct: formData.get("chequeFeePct"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  await prisma.bank.update({
    where: { id: bank.id },
    data: { chequeFeePct: D(parsed.data.chequeFeePct) },
  });

  revalidateCheques();
  return {
    ok: true,
    message:
      parsed.data.chequeFeePct > 0
        ? `Ahora cobrás ${parsed.data.chequeFeePct}% por cada cheque.`
        : "Los cheques pasan a cobrarse sin comisión.",
  };
}
