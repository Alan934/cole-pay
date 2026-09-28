"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/session";
import {
  createGoalSchema,
  goalMoveSchema,
  paymentRequestSchema,
} from "@/lib/validations";
import { getSettings } from "@/lib/settings";
import { addDays } from "@/lib/interest";
import type { ActionResult } from "@/app/actions/student";

const D = (v: number | string) => new Prisma.Decimal(v);

/* ---------------------------- Metas de ahorro ---------------------------- */

export async function createGoal(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const parsed = createGoalSchema.safeParse({
    name: formData.get("name"),
    targetAmount: formData.get("targetAmount"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  await prisma.savingsGoal.create({
    data: {
      userId: me.id,
      name: parsed.data.name,
      targetAmount: D(parsed.data.targetAmount),
    },
  });
  revalidatePath("/goals");
  return { ok: true, message: `Meta "${parsed.data.name}" creada.` };
}

/** Apartar dinero hacia una meta o retirarlo de vuelta al saldo. */
export async function moveGoalFunds(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const parsed = goalMoveSchema.safeParse({
    goalId: formData.get("goalId"),
    amount: formData.get("amount"),
    direction: formData.get("direction"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { goalId, amount, direction } = parsed.data;
  const amountDec = D(amount);

  // Las metas rinden a cambio de un mínimo de permanencia que fija el admin.
  const settings = await getSettings();
  const lockDays = settings.interestEnabled ? settings.goalsLockDays : 0;

  try {
    await prisma.$transaction(async (tx) => {
      const goal = await tx.savingsGoal.findUnique({ where: { id: goalId } });
      if (!goal || goal.userId !== me.id) throw new Error("NO_ENCONTRADA");

      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: me.id },
      });

      if (direction === "deposit") {
        if (wallet.balance.lessThan(amountDec))
          throw new Error("SALDO_INSUFICIENTE");
        await tx.wallet.update({
          where: { userId: me.id },
          data: { balance: { decrement: amountDec } },
        });
        const newSaved = goal.savedAmount.plus(amountDec);
        await tx.savingsGoal.update({
          where: { id: goalId },
          data: {
            savedAmount: newSaved,
            // Cada vez que aparta plata se reinicia el plazo mínimo.
            lockedUntil:
              lockDays > 0 ? addDays(new Date(), lockDays) : goal.lockedUntil,
            status: newSaved.greaterThanOrEqualTo(goal.targetAmount)
              ? "COMPLETED"
              : "ACTIVE",
            completedAt: newSaved.greaterThanOrEqualTo(goal.targetAmount)
              ? new Date()
              : null,
          },
        });
        await tx.transaction.create({
          data: {
            type: "SAVINGS",
            amount: amountDec,
            description: `Ahorro → ${goal.name}`,
            category: "Ahorro",
            senderId: me.id,
            receiverId: me.id,
          },
        });
      } else {
        if (goal.savedAmount.lessThan(amountDec))
          throw new Error("AHORRO_INSUFICIENTE");
        if (goal.lockedUntil && goal.lockedUntil > new Date())
          throw new Error("BLOQUEADA");
        await tx.wallet.update({
          where: { userId: me.id },
          data: { balance: { increment: amountDec } },
        });
        const newSaved = goal.savedAmount.minus(amountDec);
        await tx.savingsGoal.update({
          where: { id: goalId },
          data: {
            savedAmount: newSaved,
            status: newSaved.greaterThanOrEqualTo(goal.targetAmount)
              ? "COMPLETED"
              : "ACTIVE",
          },
        });
        await tx.transaction.create({
          data: {
            type: "SAVINGS",
            amount: amountDec,
            description: `Retiro de ahorro ← ${goal.name}`,
            category: "Ahorro",
            senderId: me.id,
            receiverId: me.id,
          },
        });
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "SALDO_INSUFICIENTE")
      return { ok: false, error: "No tenés saldo suficiente para apartar." };
    if (msg === "AHORRO_INSUFICIENTE")
      return { ok: false, error: "No hay tanto ahorrado en esta meta." };
    if (msg === "BLOQUEADA")
      return {
        ok: false,
        error:
          "Todavía no podés retirar de esta meta: falta que se cumpla el " +
          "plazo mínimo de permanencia.",
      };
    if (msg === "NO_ENCONTRADA")
      return { ok: false, error: "Meta no encontrada." };
    return { ok: false, error: "No se pudo completar la operación." };
  }

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  revalidatePath("/rendimientos");
  return {
    ok: true,
    message:
      direction === "deposit"
        ? `Apartaste ${amount.toFixed(2)} para tu meta.`
        : `Retiraste ${amount.toFixed(2)} de tu meta.`,
  };
}

export async function deleteGoal(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const goalId = String(formData.get("goalId") || "");

  try {
    await prisma.$transaction(async (tx) => {
      const goal = await tx.savingsGoal.findUnique({ where: { id: goalId } });
      if (!goal || goal.userId !== me.id) throw new Error("NO_ENCONTRADA");
      // Borrar la meta no puede ser un atajo para saltarse el plazo mínimo.
      if (
        goal.savedAmount.greaterThan(0) &&
        goal.lockedUntil &&
        goal.lockedUntil > new Date()
      )
        throw new Error("BLOQUEADA");
      // Devolver lo ahorrado al saldo disponible.
      if (goal.savedAmount.greaterThan(0)) {
        await tx.wallet.update({
          where: { userId: me.id },
          data: { balance: { increment: goal.savedAmount } },
        });
      }
      await tx.savingsGoal.delete({ where: { id: goalId } });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "BLOQUEADA")
      return {
        ok: false,
        error:
          "No podés eliminar la meta mientras el dinero esté bloqueado por " +
          "el plazo mínimo de permanencia.",
      };
    return { ok: false, error: "No se pudo eliminar la meta." };
  }

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return { ok: true, message: "Meta eliminada y ahorro devuelto a tu saldo." };
}

/* ---------------------------- Pedidos de cobro --------------------------- */

export async function createPaymentRequest(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const parsed = paymentRequestSchema.safeParse({
    amount: formData.get("amount"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  await prisma.paymentRequest.create({
    data: {
      requesterId: me.id,
      amount: D(parsed.data.amount),
      description: parsed.data.description?.trim() || null,
    },
  });
  revalidatePath("/request");
  return { ok: true, message: "Pedido de cobro creado. ¡Compartí el QR!" };
}

export async function cancelPaymentRequest(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const id = String(formData.get("requestId") || "");
  const req = await prisma.paymentRequest.findUnique({ where: { id } });
  if (!req || req.requesterId !== me.id)
    return { ok: false, error: "Pedido no encontrado." };
  if (req.status !== "PENDING")
    return { ok: false, error: "Este pedido ya no está pendiente." };

  await prisma.paymentRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/request");
  return { ok: true, message: "Pedido cancelado." };
}
