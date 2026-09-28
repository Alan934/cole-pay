"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireBankStaff, requireStudent } from "@/lib/session";
import {
  approveLoanSchema,
  loanApplicationSchema,
  payLoanSchema,
  rejectLoanSchema,
} from "@/lib/validations";
import { quoteLoan } from "@/lib/loans";
import { formatMoney } from "@/lib/utils";
import type { ActionResult } from "@/app/actions/student";

/**
 * Circuito del préstamo.
 *
 * El alumno le pide plata al banco, el banco decide cuánto le da, a qué tasa y
 * en cuántas cuotas, y al aprobar le desembolsa el capital en la billetera en
 * el momento. Después el alumno devuelve total + intereses, cuota por cuota.
 */

const D = (v: number | string) => new Prisma.Decimal(v);

/* --------------------------------- Alumno --------------------------------- */

/** El alumno le pide un préstamo a un banco. */
export async function applyForLoan(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const parsed = loanApplicationSchema.safeParse({
    bankId: formData.get("bankId"),
    requestedAmount: formData.get("requestedAmount"),
    requestedInstallments: formData.get("requestedInstallments"),
    monthlyIncome: formData.get("monthlyIncome") || undefined,
    purpose: formData.get("purpose") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const {
    bankId,
    requestedAmount,
    requestedInstallments,
    monthlyIncome,
    purpose,
  } = parsed.data;

  const bank = await prisma.bank.findUnique({
    where: { id: bankId },
    select: { id: true, name: true, active: true, maxLoanAmount: true },
  });
  if (!bank) return { ok: false, error: "No se encontró el banco." };
  if (!bank.active)
    return { ok: false, error: `${bank.name} no está dando préstamos.` };

  const max = Number(bank.maxLoanAmount);
  if (max > 0 && requestedAmount > max) {
    return {
      ok: false,
      error: `${bank.name} presta hasta ${formatMoney(max)} por vez.`,
    };
  }

  const open = await prisma.loan.findFirst({
    where: { borrowerId: me.id, bankId, status: { in: ["PENDING", "ACTIVE"] } },
    select: { status: true },
  });
  if (open) {
    return {
      ok: false,
      error:
        open.status === "PENDING"
          ? `Ya tenés un pedido esperando respuesta en ${bank.name}.`
          : `Todavía estás pagando un préstamo de ${bank.name}.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.loan.create({
      data: {
        borrowerId: me.id,
        bankId,
        requestedAmount: D(requestedAmount),
        requestedInstallments,
        monthlyIncome: monthlyIncome === undefined ? null : D(monthlyIncome),
        purpose: purpose?.trim() || null,
      },
    });

    const staff = await tx.user.findMany({
      where: { role: "BANK_EMPLOYEE", bankId },
      select: { id: true },
    });
    if (staff.length > 0) {
      await tx.notification.createMany({
        data: staff.map((s) => ({
          userId: s.id,
          type: "LOAN_APPLICATION" as const,
          title: "Nuevo pedido de préstamo",
          body: `${me.name} pidió ${formatMoney(requestedAmount)} en ${requestedInstallments} cuotas.`,
        })),
      });
    }
  });

  revalidatePath("/loans");
  revalidatePath("/bank");
  revalidatePath("/bank/loans");
  return {
    ok: true,
    message: `Enviaste el pedido a ${bank.name}. Ahora lo tiene que evaluar el banco.`,
  };
}

/** El alumno da de baja su pedido mientras nadie lo revisó. */
export async function cancelLoan(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const loanId = String(formData.get("loanId") || "");

  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan || loan.borrowerId !== me.id)
    return { ok: false, error: "No se encontró el pedido." };
  if (loan.status !== "PENDING")
    return { ok: false, error: "El banco ya respondió este pedido." };

  await prisma.loan.update({
    where: { id: loanId },
    data: { status: "CANCELLED", reviewedAt: new Date() },
  });

  revalidatePath("/loans");
  revalidatePath("/bank/loans");
  return { ok: true, message: "Diste de baja el pedido." };
}

/** El alumno paga una cuota (o el monto que quiera) desde su billetera. */
export async function payLoanInstallment(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const parsed = payLoanSchema.safeParse({
    loanId: formData.get("loanId"),
    amount: formData.get("amount"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { loanId, amount } = parsed.data;
  const amountDec = D(amount);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({
        where: { id: loanId },
        include: { bank: { select: { name: true, accountId: true } } },
      });
      if (!loan || loan.borrowerId !== me.id) throw new Error("NO_ENCONTRADO");
      if (loan.status !== "ACTIVE") throw new Error("NO_ACTIVO");

      const total = loan.totalToRepay ?? D(0);
      const remaining = total.minus(loan.paidAmount);
      if (remaining.lessThanOrEqualTo(0)) throw new Error("YA_PAGADO");
      if (amountDec.greaterThan(remaining)) throw new Error("MONTO_EXCEDE");

      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: me.id },
      });
      if (wallet.balance.lessThan(amountDec))
        throw new Error("SALDO_INSUFICIENTE");

      await tx.wallet.update({
        where: { userId: me.id },
        data: { balance: { decrement: amountDec } },
      });
      await tx.wallet.update({
        where: { userId: loan.bank.accountId },
        data: { balance: { increment: amountDec } },
      });

      const movement = await tx.transaction.create({
        data: {
          type: "LOAN_PAYMENT",
          amount: amountDec,
          description: `Cuota de préstamo — ${loan.bank.name}`,
          category: "Servicios",
          senderId: me.id,
          receiverId: loan.bank.accountId,
        },
      });

      await tx.loanPayment.create({
        data: { loanId: loan.id, amount: amountDec, transactionId: movement.id },
      });

      const paidAmount = loan.paidAmount.plus(amountDec);
      const settled = paidAmount.greaterThanOrEqualTo(total);
      await tx.loan.update({
        where: { id: loan.id },
        data: {
          paidAmount,
          status: settled ? "PAID" : "ACTIVE",
          paidAt: settled ? new Date() : null,
        },
      });

      return { settled, left: total.minus(paidAmount) };
    });

    revalidatePath("/loans");
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    revalidatePath("/bank");
    return {
      ok: true,
      message: result.settled
        ? "¡Terminaste de pagar el préstamo! Ya no le debés nada al banco."
        : `Cuota pagada. Te quedan ${formatMoney(Number(result.left))} por devolver.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "SALDO_INSUFICIENTE")
      return { ok: false, error: "No te alcanza el saldo para pagar esa cuota." };
    if (msg === "MONTO_EXCEDE")
      return { ok: false, error: "El monto es mayor a lo que debés." };
    if (msg === "YA_PAGADO")
      return { ok: false, error: "Este préstamo ya está pagado." };
    if (msg === "NO_ACTIVO")
      return { ok: false, error: "Este préstamo no está vigente." };
    if (msg === "NO_ENCONTRADO")
      return { ok: false, error: "No se encontró el préstamo." };
    return { ok: false, error: "No se pudo registrar el pago." };
  }
}

/* ---------------------------------- Banco --------------------------------- */

function canOperate(
  staff: { role: string; bankId: string | null },
  bankId: string,
): boolean {
  if (staff.role === "ADMIN" || staff.role === "BANK_ADMIN") return true;
  return staff.bankId === bankId;
}

/**
 * El banco aprueba el préstamo y desembolsa el capital en el acto. Si no tiene
 * caja suficiente no puede prestar, igual que un banco de verdad.
 */
export async function approveLoan(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const staff = await requireBankStaff();
  const parsed = approveLoanSchema.safeParse({
    loanId: formData.get("loanId"),
    principal: formData.get("principal"),
    monthlyRatePct: formData.get("monthlyRatePct"),
    installments: formData.get("installments"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { loanId, principal, monthlyRatePct, installments, note } = parsed.data;

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      borrower: { select: { id: true, name: true } },
      bank: { select: { id: true, name: true, accountId: true } },
    },
  });
  if (!loan) return { ok: false, error: "No se encontró el pedido." };
  if (!canOperate(staff, loan.bankId))
    return { ok: false, error: "Ese pedido es de otro banco." };
  if (loan.status !== "PENDING")
    return { ok: false, error: "Este pedido ya fue resuelto." };

  const quote = quoteLoan(principal, monthlyRatePct, installments);
  const principalDec = D(principal);

  try {
    await prisma.$transaction(async (tx) => {
      const bankWallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: loan.bank.accountId },
      });
      if (bankWallet.balance.lessThan(principalDec))
        throw new Error("SIN_CAJA");

      await tx.wallet.update({
        where: { userId: loan.bank.accountId },
        data: { balance: { decrement: principalDec } },
      });
      await tx.wallet.update({
        where: { userId: loan.borrowerId },
        data: { balance: { increment: principalDec } },
      });

      const movement = await tx.transaction.create({
        data: {
          type: "LOAN_DISBURSEMENT",
          amount: principalDec,
          description: `Préstamo de ${loan.bank.name} en ${installments} cuotas`,
          senderId: loan.bank.accountId,
          receiverId: loan.borrowerId,
        },
      });

      await tx.loan.update({
        where: { id: loan.id },
        data: {
          status: "ACTIVE",
          reviewedAt: new Date(),
          reviewedById: staff.id,
          reviewNote: note?.trim() || null,
          principal: principalDec,
          monthlyRatePct: D(monthlyRatePct),
          installments,
          installmentAmount: D(quote.installmentAmount),
          totalToRepay: D(quote.total),
          disbursedAt: new Date(),
          transactionId: movement.id,
        },
      });

      await tx.notification.create({
        data: {
          userId: loan.borrowerId,
          type: "LOAN_APPROVED",
          title: "¡Te aprobaron el préstamo!",
          body: `${loan.bank.name} te depositó ${formatMoney(principal)}. Devolvés ${formatMoney(quote.total)} en ${installments} cuotas de ${formatMoney(quote.installmentAmount)}.`,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "SIN_CAJA") {
      return {
        ok: false,
        error:
          "El banco no tiene caja suficiente para desembolsar ese monto. Pedile a la profe que lo capitalice.",
      };
    }
    return { ok: false, error: "No se pudo otorgar el préstamo." };
  }

  revalidatePath("/bank");
  revalidatePath("/bank/loans");
  revalidatePath("/admin/cards");
  revalidatePath("/loans");
  return {
    ok: true,
    message: `Le prestaste ${formatMoney(principal)} a ${loan.borrower.name}.`,
  };
}

/** El banco rechaza el pedido, con motivo. */
export async function rejectLoan(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const staff = await requireBankStaff();
  const parsed = rejectLoanSchema.safeParse({
    loanId: formData.get("loanId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { loanId, reason } = parsed.data;
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { bank: { select: { name: true } } },
  });
  if (!loan) return { ok: false, error: "No se encontró el pedido." };
  if (!canOperate(staff, loan.bankId))
    return { ok: false, error: "Ese pedido es de otro banco." };
  if (loan.status !== "PENDING")
    return { ok: false, error: "Este pedido ya fue resuelto." };

  await prisma.$transaction(async (tx) => {
    await tx.loan.update({
      where: { id: loan.id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: staff.id,
        reviewNote: reason,
      },
    });
    await tx.notification.create({
      data: {
        userId: loan.borrowerId,
        type: "LOAN_REJECTED",
        title: "Rechazaron tu pedido de préstamo",
        body: `${loan.bank.name} no te dio el préstamo. Motivo: ${reason}`,
      },
    });
  });

  revalidatePath("/bank");
  revalidatePath("/bank/loans");
  revalidatePath("/admin/cards");
  revalidatePath("/loans");
  return { ok: true, message: "Pedido rechazado." };
}
