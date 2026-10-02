"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireBankStaff, requireStudent } from "@/lib/session";
import { bankDepositTermSchema, openDepositSchema } from "@/lib/validations";
import { addDays, simpleInterest } from "@/lib/interest";
import { formatMoney } from "@/lib/utils";
import { isAdhered, notAdheredMessage } from "@/lib/memberships";
import type { ActionResult } from "@/app/actions/student";

/**
 * Plazo fijo.
 *
 * El alumno de tercero inmoviliza plata en uno de los bancos de quinto y el
 * banco le paga un interés por eso. La plata **se va de verdad** a la caja del
 * banco: por eso el banco puede prestarla, y por eso al vencimiento tiene que
 * tener con qué pagar el capital más el interés.
 *
 * Ahí está el negocio bancario completo y a la vista: cada banco pone su
 * propia TNA en la pizarra, toma depósitos a esa tasa y presta a otra. La
 * diferencia entre las dos es lo que gana.
 *
 * Quedan plazos fijos viejos con `bankId` en null, de cuando los tomaba el
 * Banco Central. Esos se siguen pudiendo retirar como antes.
 */

const D = (v: number | string) => new Prisma.Decimal(v);

function revalidateDeposits() {
  revalidatePath("/deposits");
  revalidatePath("/dashboard");
  revalidatePath("/rendimientos");
  revalidatePath("/activity");
  revalidatePath("/bank/deposits");
  revalidatePath("/bank");
  revalidatePath("/bank/account");
}

/* --------------------------------- Alumno --------------------------------- */

/** Constituir un plazo fijo en un banco, al plazo y la tasa de su pizarra. */
export async function openDeposit(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const parsed = openDepositSchema.safeParse({
    bankId: formData.get("bankId"),
    termId: formData.get("termId"),
    principal: formData.get("principal"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { bankId, termId, principal } = parsed.data;
  const principalDec = D(principal);

  const term = await prisma.depositTerm.findUnique({
    where: { id: termId },
    include: { bank: { select: { id: true, name: true, accountId: true, active: true } } },
  });
  if (!term || !term.active || !term.bank || term.bank.id !== bankId)
    return { ok: false, error: "Ese plazo ya no está disponible." };
  if (!term.bank.active)
    return { ok: false, error: `${term.bank.name} no está tomando depósitos.` };
  if (!(await isAdhered(me.id, term.bank.id)))
    return { ok: false, error: notAdheredMessage(term.bank.name) };

  const tnaPct = Number(term.tnaPct);
  const interest = simpleInterest(principal, tnaPct, term.days);
  const bank = term.bank;

  try {
    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: me.id },
      });
      if (wallet.balance.lessThan(principalDec))
        throw new Error("SALDO_INSUFICIENTE");

      await tx.wallet.update({
        where: { userId: me.id },
        data: { balance: { decrement: principalDec } },
      });
      await tx.wallet.update({
        where: { userId: bank.accountId },
        data: { balance: { increment: principalDec } },
      });

      const movement = await tx.transaction.create({
        data: {
          type: "FIXED_DEPOSIT_OPEN",
          amount: principalDec,
          description: `Plazo fijo a ${term.days} días en ${bank.name} (${tnaPct}% TNA)`,
          category: "Ahorro",
          senderId: me.id,
          receiverId: bank.accountId,
          bankId: bank.id,
        },
      });

      await tx.fixedDeposit.create({
        data: {
          userId: me.id,
          bankId: bank.id,
          principal: principalDec,
          ratePct: term.tnaPct,
          termDays: term.days,
          maturesAt: addDays(new Date(), term.days),
          openTransactionId: movement.id,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "SALDO_INSUFICIENTE")
      return { ok: false, error: "No tenés saldo suficiente." };
    return { ok: false, error: "No se pudo crear el plazo fijo." };
  }

  revalidateDeposits();
  return {
    ok: true,
    message:
      `Plazo fijo creado en ${bank.name}. Al vencer cobrás ` +
      `${formatMoney(principal + interest)} (${formatMoney(interest)} de interés).`,
  };
}

/** Retirar un plazo fijo vencido: capital + interés, pagados por el banco. */
export async function withdrawDeposit(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const depositId = String(formData.get("depositId") || "");

  try {
    const payout = await prisma.$transaction(async (tx) => {
      const dep = await tx.fixedDeposit.findUnique({
        where: { id: depositId },
        include: { bank: { select: { id: true, name: true, accountId: true } } },
      });
      if (!dep || dep.userId !== me.id) throw new Error("NO_ENCONTRADO");
      if (dep.status !== "ACTIVE") throw new Error("YA_RETIRADO");
      if (dep.maturesAt > new Date()) throw new Error("NO_VENCIDO");

      // Interés por TNA: principal × (TNA/100) × (días/365).
      const interestNum = simpleInterest(
        Number(dep.principal),
        Number(dep.ratePct),
        dep.termDays,
      );
      const interest = D(interestNum);
      const total = dep.principal.plus(interest);
      const bank = dep.bank;

      // El banco paga de su caja. Si prestó todo lo que le depositaron, no
      // llega: le toca cobrar resúmenes o pedir capitalización.
      if (bank) {
        const bankWallet = await tx.wallet.findUniqueOrThrow({
          where: { userId: bank.accountId },
        });
        if (bankWallet.balance.lessThan(total)) throw new Error("BANCO_SIN_FONDOS");
        await tx.wallet.update({
          where: { userId: bank.accountId },
          data: { balance: { decrement: total } },
        });
      }

      await tx.wallet.update({
        where: { userId: me.id },
        data: { balance: { increment: total } },
      });
      await tx.fixedDeposit.update({
        where: { id: depositId },
        data: {
          status: "WITHDRAWN",
          withdrawnAt: new Date(),
          payoutAmount: total,
        },
      });

      // Dos movimientos separados a propósito: la devolución del capital y el
      // interés ganado, que es el número que interesa mirar.
      const payoutTx = await tx.transaction.create({
        data: {
          type: "FIXED_DEPOSIT_PAYOUT",
          amount: dep.principal,
          description: bank
            ? `Plazo fijo devuelto por ${bank.name}`
            : "Plazo fijo devuelto",
          category: "Ahorro",
          senderId: bank ? bank.accountId : null,
          receiverId: me.id,
          bankId: bank?.id ?? null,
        },
      });
      await tx.fixedDeposit.update({
        where: { id: depositId },
        data: { payoutTransactionId: payoutTx.id },
      });

      const interestTx = await tx.transaction.create({
        data: {
          type: "INTEREST",
          amount: interest,
          description: `Interés de plazo fijo (${Number(dep.ratePct)}% TNA a ${dep.termDays} días)`,
          category: "Ahorro",
          senderId: bank ? bank.accountId : null,
          receiverId: me.id,
          bankId: bank?.id ?? null,
        },
      });
      // Detalle del cálculo, para que el alumno pueda rehacer la cuenta.
      await tx.interestAccrual.create({
        data: {
          source: "BALANCE",
          base: dep.principal,
          tnaPct: dep.ratePct,
          days: dep.termDays,
          interest,
          userId: me.id,
          transactionId: interestTx.id,
        },
      });

      return { interest: interestNum, total: Number(total) };
    });

    revalidateDeposits();
    return {
      ok: true,
      message: `Cobraste ${formatMoney(payout.total)} (interés: ${formatMoney(payout.interest)}).`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NO_VENCIDO")
      return { ok: false, error: "El plazo fijo todavía no venció." };
    if (msg === "YA_RETIRADO")
      return { ok: false, error: "Este plazo fijo ya fue retirado." };
    if (msg === "BANCO_SIN_FONDOS")
      return {
        ok: false,
        error:
          "El banco no tiene caja para pagarte todavía. Avisale al mostrador " +
          "y volvé a intentar.",
      };
    return { ok: false, error: "No se pudo retirar el plazo fijo." };
  }
}

/**
 * Romper un plazo fijo antes del vencimiento: se recupera el capital pero
 * **se pierde todo el interés**. Es el costo real de haber inmovilizado la
 * plata y después arrepentirse.
 */
export async function breakDeposit(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const depositId = String(formData.get("depositId") || "");

  try {
    const principal = await prisma.$transaction(async (tx) => {
      const dep = await tx.fixedDeposit.findUnique({
        where: { id: depositId },
        include: { bank: { select: { id: true, name: true, accountId: true } } },
      });
      if (!dep || dep.userId !== me.id) throw new Error("NO_ENCONTRADO");
      if (dep.status !== "ACTIVE") throw new Error("YA_RETIRADO");
      if (dep.maturesAt <= new Date()) throw new Error("YA_VENCIDO");

      const bank = dep.bank;
      if (bank) {
        const bankWallet = await tx.wallet.findUniqueOrThrow({
          where: { userId: bank.accountId },
        });
        if (bankWallet.balance.lessThan(dep.principal))
          throw new Error("BANCO_SIN_FONDOS");
        await tx.wallet.update({
          where: { userId: bank.accountId },
          data: { balance: { decrement: dep.principal } },
        });
      }

      await tx.wallet.update({
        where: { userId: me.id },
        data: { balance: { increment: dep.principal } },
      });
      await tx.fixedDeposit.update({
        where: { id: depositId },
        data: {
          status: "BROKEN",
          withdrawnAt: new Date(),
          payoutAmount: dep.principal,
        },
      });
      const movement = await tx.transaction.create({
        data: {
          type: "FIXED_DEPOSIT_PAYOUT",
          amount: dep.principal,
          description: "Plazo fijo roto antes de tiempo (sin interés)",
          category: "Ahorro",
          senderId: bank ? bank.accountId : null,
          receiverId: me.id,
          bankId: bank?.id ?? null,
        },
      });
      await tx.fixedDeposit.update({
        where: { id: depositId },
        data: { payoutTransactionId: movement.id },
      });

      return Number(dep.principal);
    });

    revalidateDeposits();
    return {
      ok: true,
      message: `Recuperaste tu capital (${formatMoney(principal)}), pero perdiste el interés.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "YA_VENCIDO")
      return {
        ok: false,
        error: "El plazo fijo ya venció: retiralo con el interés.",
      };
    if (msg === "YA_RETIRADO")
      return { ok: false, error: "Este plazo fijo ya fue retirado." };
    if (msg === "BANCO_SIN_FONDOS")
      return {
        ok: false,
        error: "El banco no tiene caja para devolverte el capital todavía.",
      };
    return { ok: false, error: "No se pudo romper el plazo fijo." };
  }
}

/* ---------------------- Pizarra de tasas del banco ------------------------ */

/** El mostrador da de alta (o corrige) un plazo de su pizarra. */
export async function saveBankTerm(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireBankStaff();
  const bank = me.bank;
  if (!bank) return { ok: false, error: "No estás asignado a un banco." };

  const parsed = bankDepositTermSchema.safeParse({
    days: formData.get("days"),
    tnaPct: formData.get("tnaPct"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { days, tnaPct } = parsed.data;
  await prisma.depositTerm.upsert({
    where: { bankId_days: { bankId: bank.id, days } },
    update: { tnaPct: D(tnaPct), active: true },
    create: { bankId: bank.id, days, tnaPct: D(tnaPct) },
  });

  revalidateDeposits();
  return {
    ok: true,
    message: `Plazo de ${days} días al ${tnaPct}% TNA publicado en la pizarra.`,
  };
}

/** Saca o vuelve a poner un plazo en la pizarra. */
export async function toggleBankTerm(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireBankStaff();
  const bank = me.bank;
  if (!bank) return { ok: false, error: "No estás asignado a un banco." };

  const termId = String(formData.get("termId") || "");
  const term = await prisma.depositTerm.findUnique({ where: { id: termId } });
  if (!term || term.bankId !== bank.id)
    return { ok: false, error: "No se encontró el plazo." };

  await prisma.depositTerm.update({
    where: { id: termId },
    data: { active: !term.active },
  });

  revalidateDeposits();
  return {
    ok: true,
    message: term.active
      ? `Sacaste el plazo de ${term.days} días de la pizarra.`
      : `Volviste a ofrecer el plazo de ${term.days} días.`,
  };
}
