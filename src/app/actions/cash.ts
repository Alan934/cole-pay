"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireBankStaff } from "@/lib/session";
import { cashOperationSchema } from "@/lib/validations";
import { formatMoney } from "@/lib/utils";
import type { ActionResult } from "@/app/actions/student";

/**
 * La ventanilla: efectivo que entra y sale del banco.
 *
 * Los billetes del aula viven fuera de la app. Cuando un alumno los trae al
 * mostrador, entran al sistema: se le acreditan en la billetera **y** quedan
 * en la caja del banco, que es el que los guarda. La extracción es el camino
 * de vuelta.
 *
 * De ahí sale la lección más linda de todas: la plata que el banco recibió en
 * depósitos es la que después presta. Si la prestó toda y los clientes vienen
 * a retirar, no le alcanza la caja. Eso no es un bug, es una corrida.
 */

const D = (v: number | string) => new Prisma.Decimal(v);

function revalidateCash() {
  revalidatePath("/bank/caja");
  revalidatePath("/bank");
  revalidatePath("/bank/account");
  revalidatePath("/dashboard");
  revalidatePath("/activity");
}

/** Comprueba que el cliente sea un alumno con billetera. */
async function findCustomer(customerId: string) {
  return prisma.user.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, role: true, wallet: { select: { id: true } } },
  });
}

/**
 * Depósito en efectivo: el alumno entrega billetes y el banco se los acredita.
 * Suben las dos puntas —la billetera del alumno y la caja del banco— porque el
 * efectivo entra al sistema en este momento.
 */
export async function depositCash(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireBankStaff();
  const bank = me.bank;
  if (!bank) return { ok: false, error: "No estás asignado a un banco." };

  const parsed = cashOperationSchema.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { customerId, amount, note } = parsed.data;
  const customer = await findCustomer(customerId);
  if (!customer || customer.role !== "STUDENT" || !customer.wallet)
    return { ok: false, error: "El cliente no es un alumno con billetera." };

  const amountDec = D(amount);

  await prisma.$transaction(async (tx) => {
    // Entra a la caja del banco.
    await tx.wallet.update({
      where: { userId: bank.accountId },
      data: { balance: { increment: amountDec } },
    });
    await tx.transaction.create({
      data: {
        type: "CASH_DEPOSIT",
        amount: amountDec,
        description: `Efectivo recibido de ${customer.name}`,
        category: "Ventanilla",
        receiverId: bank.accountId,
        bankId: bank.id,
      },
    });

    // Y se le acredita al alumno.
    await tx.wallet.update({
      where: { userId: customer.id },
      data: { balance: { increment: amountDec } },
    });
    const movement = await tx.transaction.create({
      data: {
        type: "CASH_DEPOSIT",
        amount: amountDec,
        description: note?.trim() || `Depósito en efectivo en ${bank.name}`,
        category: "Ventanilla",
        receiverId: customer.id,
        bankId: bank.id,
      },
    });

    await tx.cashOperation.create({
      data: {
        kind: "DEPOSIT",
        amount: amountDec,
        note: note?.trim() || null,
        bankId: bank.id,
        customerId: customer.id,
        tellerId: me.id,
        transactionId: movement.id,
      },
    });

    await tx.notification.create({
      data: {
        userId: customer.id,
        type: "MONEY_RECEIVED",
        title: "Depósito acreditado",
        body: `${bank.name} te acreditó ${formatMoney(amount)} en efectivo.`,
      },
    });
  });

  revalidateCash();
  return {
    ok: true,
    message: `Depositaste ${formatMoney(amount)} en la cuenta de ${customer.name}.`,
  };
}

/**
 * Extracción: el alumno se lleva los billetes. Bajan las dos puntas, y el
 * banco tiene que tener el efectivo en la caja para poder pagarlo.
 */
export async function withdrawCash(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireBankStaff();
  const bank = me.bank;
  if (!bank) return { ok: false, error: "No estás asignado a un banco." };

  const parsed = cashOperationSchema.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { customerId, amount, note } = parsed.data;
  const customer = await findCustomer(customerId);
  if (!customer || customer.role !== "STUDENT" || !customer.wallet)
    return { ok: false, error: "El cliente no es un alumno con billetera." };

  const amountDec = D(amount);

  try {
    await prisma.$transaction(async (tx) => {
      const customerWallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: customer.id },
      });
      if (customerWallet.balance.lessThan(amountDec))
        throw new Error("SALDO_INSUFICIENTE");

      const bankWallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: bank.accountId },
      });
      if (bankWallet.balance.lessThan(amountDec))
        throw new Error("BANCO_SIN_EFECTIVO");

      await tx.wallet.update({
        where: { userId: customer.id },
        data: { balance: { decrement: amountDec } },
      });
      const movement = await tx.transaction.create({
        data: {
          type: "CASH_WITHDRAWAL",
          amount: amountDec,
          description: note?.trim() || `Extracción de efectivo en ${bank.name}`,
          category: "Ventanilla",
          senderId: customer.id,
          bankId: bank.id,
        },
      });

      await tx.wallet.update({
        where: { userId: bank.accountId },
        data: { balance: { decrement: amountDec } },
      });
      await tx.transaction.create({
        data: {
          type: "CASH_WITHDRAWAL",
          amount: amountDec,
          description: `Efectivo entregado a ${customer.name}`,
          category: "Ventanilla",
          senderId: bank.accountId,
          bankId: bank.id,
        },
      });

      await tx.cashOperation.create({
        data: {
          kind: "WITHDRAWAL",
          amount: amountDec,
          note: note?.trim() || null,
          bankId: bank.id,
          customerId: customer.id,
          tellerId: me.id,
          transactionId: movement.id,
        },
      });
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "SALDO_INSUFICIENTE")
      return {
        ok: false,
        error: `${customer.name} no tiene ${formatMoney(amount)} en la cuenta.`,
      };
    if (code === "BANCO_SIN_EFECTIVO")
      return {
        ok: false,
        error:
          "La caja del banco no tiene ese efectivo. Cobrá resúmenes o pedile " +
          "a la profe que capitalice el banco.",
      };
    return { ok: false, error: "No se pudo hacer la extracción." };
  }

  revalidateCash();
  return {
    ok: true,
    message: `${customer.name} retiró ${formatMoney(amount)} en efectivo.`,
  };
}
