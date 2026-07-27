"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStudent } from "@/lib/session";
import { SETTINGS_ID, getSettings } from "@/lib/settings";
import { accrueInterest } from "@/lib/accrual";
import { applyInflation } from "@/lib/inflation";
import {
  bankSettingsSchema,
  inflationSchema,
  depositTermSchema,
  forceAccrualSchema,
  quizAnswerSchema,
} from "@/lib/validations";
import { QUIZ_QUESTIONS } from "@/lib/quiz";
import { formatMoney } from "@/lib/utils";
import type { ActionResult } from "@/app/actions/student";

const D = (v: number | string) => new Prisma.Decimal(v);

/** Refresca todas las pantallas que muestran tasas o saldos. */
function revalidateEverything() {
  for (const p of [
    "/admin/rendimientos",
    "/admin",
    "/admin/reports",
    "/dashboard",
    "/rendimientos",
    "/deposits",
    "/goals",
    "/activity",
  ]) {
    revalidatePath(p);
  }
}

/* --------------------------- Configuración ---------------------------- */

export async function updateBankSettings(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = bankSettingsSchema.safeParse({
    interestEnabled: formData.get("interestEnabled"),
    balanceTnaPct: formData.get("balanceTnaPct"),
    goalsTnaPct: formData.get("goalsTnaPct"),
    goalsLockDays: formData.get("goalsLockDays"),
    minBalanceToEarn: formData.get("minBalanceToEarn"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const d = parsed.data;
  await getSettings(); // garantiza que la fila exista
  await prisma.bankSettings.update({
    where: { id: SETTINGS_ID },
    data: {
      interestEnabled: d.interestEnabled,
      balanceTnaPct: D(d.balanceTnaPct),
      goalsTnaPct: D(d.goalsTnaPct),
      goalsLockDays: d.goalsLockDays,
      minBalanceToEarn: D(d.minBalanceToEarn),
    },
  });

  revalidateEverything();
  return {
    ok: true,
    message: d.interestEnabled
      ? "Rendimientos activados y tasas actualizadas."
      : "Configuración guardada (rendimientos desactivados).",
  };
}

export async function updateInflationSettings(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = inflationSchema.safeParse({
    inflationEnabled: formData.get("inflationEnabled"),
    monthlyInflationPct: formData.get("monthlyInflationPct"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  await getSettings();
  await prisma.bankSettings.update({
    where: { id: SETTINGS_ID },
    data: {
      inflationEnabled: parsed.data.inflationEnabled,
      monthlyInflationPct: D(parsed.data.monthlyInflationPct),
    },
  });

  revalidateEverything();
  return { ok: true, message: "Configuración de inflación guardada." };
}

/* ------------------------------ Plazos -------------------------------- */

export async function saveDepositTerm(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = depositTermSchema.safeParse({
    days: formData.get("days"),
    tnaPct: formData.get("tnaPct"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  await getSettings();
  await prisma.depositTerm.upsert({
    where: { days: parsed.data.days },
    update: { tnaPct: D(parsed.data.tnaPct), active: true },
    create: {
      days: parsed.data.days,
      tnaPct: D(parsed.data.tnaPct),
      settingsId: SETTINGS_ID,
    },
  });

  revalidateEverything();
  return {
    ok: true,
    message: `Plazo de ${parsed.data.days} días al ${parsed.data.tnaPct}% TNA guardado.`,
  };
}

export async function toggleDepositTerm(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("termId") || "");
  const term = await prisma.depositTerm.findUnique({ where: { id } });
  if (!term) return { ok: false, error: "Plazo no encontrado." };

  await prisma.depositTerm.update({
    where: { id },
    data: { active: !term.active },
  });

  revalidateEverything();
  return {
    ok: true,
    message: term.active
      ? `Plazo de ${term.days} días dado de baja.`
      : `Plazo de ${term.days} días reactivado.`,
  };
}

/* --------------------------- Liquidación ------------------------------ */

/**
 * Válvula de seguridad: normalmente los intereses los acredita el cron diario.
 * Esto sirve para recuperar un día que se perdió o para simular el paso del
 * tiempo en clase ("hoy hacemos de cuenta que pasó un mes").
 */
export async function forceAccrual(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = forceAccrualSchema.safeParse({ days: formData.get("days") });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const result = await accrueInterest({
    trigger: "MANUAL",
    days: parsed.data.days,
  });

  revalidateEverything();
  if (!result.ok) return { ok: false, error: result.reason };
  if (result.walletsCount === 0)
    return {
      ok: true,
      message:
        "No hubo intereses para acreditar: ningún alumno llega al saldo mínimo.",
    };
  return {
    ok: true,
    message:
      `Liquidaste ${result.days} día(s): ${formatMoney(result.totalPaid)} ` +
      `repartidos entre ${result.walletsCount} alumno(s).`,
  };
}

/** Aplica un ajuste de precios por inflación al índice y a los cobros. */
export async function forceInflation(
  _prev: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const result = await applyInflation({ trigger: "MANUAL" });

  revalidateEverything();
  if (!result.ok) return { ok: false, error: result.reason };
  return {
    ok: true,
    message:
      `Precios actualizados ${result.appliedPct}%. ` +
      `Índice: ${result.priceIndex.toFixed(2)}. ` +
      `${result.chargesUpdated} cobro(s) recurrente(s) ajustado(s).`,
  };
}

/* -------------------------------- Quiz -------------------------------- */

export async function answerQuiz(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const parsed = quizAnswerSchema.safeParse({
    questionId: formData.get("questionId"),
    answer: formData.get("answer"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const question = QUIZ_QUESTIONS.find((q) => q.id === parsed.data.questionId);
  if (!question) return { ok: false, error: "Pregunta no encontrada." };

  const correct = parsed.data.answer === question.correct;
  await prisma.quizAttempt.create({
    data: {
      userId: me.id,
      questionId: question.id,
      answer: parsed.data.answer,
      correct,
    },
  });

  revalidatePath("/rendimientos");
  return correct
    ? { ok: true, message: `¡Correcto! ${question.explanation}` }
    : { ok: false, error: `No es esa. Pista: ${question.hint}` };
}
