"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireBankStaff } from "@/lib/session";
import { adhereStudentSchema, endMembershipSchema } from "@/lib/validations";
import { ACTIVE_MEMBERSHIP } from "@/lib/memberships";
import type { ActionResult } from "@/app/actions/student";

/**
 * Adhesión de los alumnos de tercero a un banco.
 *
 * El alumno se presenta en el mostrador, el trámite se hace en persona y el
 * empleado de quinto carga la relación en el sistema. No hay forma de
 * adherirse desde la app del alumno, a propósito.
 */

function revalidateMemberships() {
  revalidatePath("/bank/clients");
  revalidatePath("/bank");
  revalidatePath("/my-banks");
  revalidatePath("/cards");
  revalidatePath("/loans");
  revalidatePath("/deposits");
  revalidatePath("/cheques");
}

/** El empleado da de alta a un alumno de tercero como cliente de su banco. */
export async function adhereStudent(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireBankStaff();
  const bank = me.bank;
  if (!bank) return { ok: false, error: "No estás asignado a un banco." };

  const parsed = adhereStudentSchema.safeParse({
    studentId: formData.get("studentId"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { studentId, note } = parsed.data;

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, role: true },
  });
  if (!student || student.role !== "STUDENT")
    return { ok: false, error: "El alumno elegido no es de tercero año." };

  const [existing, otherBanks] = await Promise.all([
    prisma.bankMembership.findUnique({
      where: { studentId_bankId: { studentId, bankId: bank.id } },
    }),
    prisma.bankMembership.count({
      where: { studentId, bankId: { not: bank.id }, ...ACTIVE_MEMBERSHIP },
    }),
  ]);
  if (existing && existing.endedAt === null)
    return {
      ok: false,
      error: `${student.name} ya es cliente de ${bank.name}.`,
    };

  const data = {
    adheredAt: new Date(),
    endedAt: null,
    note: note?.trim() || null,
    registeredById: me.id,
  };

  await prisma.$transaction(async (tx) => {
    // Si ya había sido cliente y se dio de baja, vuelve a la misma fila: la
    // relación es única por alumno y banco.
    if (existing) {
      await tx.bankMembership.update({ where: { id: existing.id }, data });
    } else {
      await tx.bankMembership.create({
        data: { ...data, studentId, bankId: bank.id },
      });
    }

    await tx.notification.create({
      data: {
        userId: studentId,
        type: "GENERIC",
        title: `Ya sos cliente de ${bank.name}`,
        body:
          otherBanks === 0
            ? `${bank.name} te dio de alta como cliente. Es tu banco principal: ya podés pedirle tarjeta, préstamo o hacer un plazo fijo.`
            : `${bank.name} te dio de alta como cliente. Ya podés operar con este banco.`,
      },
    });
  });

  revalidateMemberships();
  return {
    ok: true,
    message:
      otherBanks === 0
        ? `${student.name} quedó adherido a ${bank.name}. Es su banco principal.`
        : `${student.name} quedó adherido a ${bank.name}.`,
  };
}

/**
 * Baja de una adhesión. No se puede mientras el alumno tenga algo abierto con
 * el banco: una deuda no desaparece porque deje de ser cliente.
 */
export async function endMembership(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireBankStaff();
  const bank = me.bank;
  if (!bank) return { ok: false, error: "No estás asignado a un banco." };

  const parsed = endMembershipSchema.safeParse({
    membershipId: formData.get("membershipId"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const membership = await prisma.bankMembership.findUnique({
    where: { id: parsed.data.membershipId },
    include: { student: { select: { id: true, name: true } } },
  });
  if (!membership || membership.bankId !== bank.id)
    return { ok: false, error: "No se encontró la adhesión." };
  if (membership.endedAt !== null)
    return { ok: false, error: "Esa adhesión ya estaba dada de baja." };

  const studentId = membership.studentId;
  const [cards, loans, deposits, applications] = await Promise.all([
    prisma.creditCard.count({
      where: { ownerId: studentId, bankId: bank.id, status: { in: ["ACTIVE", "BLOCKED"] } },
    }),
    prisma.loan.count({
      where: { borrowerId: studentId, bankId: bank.id, status: { in: ["PENDING", "ACTIVE"] } },
    }),
    prisma.fixedDeposit.count({
      where: { userId: studentId, bankId: bank.id, status: "ACTIVE" },
    }),
    prisma.cardApplication.count({
      where: { applicantId: studentId, bankId: bank.id, status: "PENDING" },
    }),
  ]);

  const open: string[] = [];
  if (cards > 0) open.push(cards === 1 ? "una tarjeta" : `${cards} tarjetas`);
  if (loans > 0) open.push(loans === 1 ? "un préstamo" : `${loans} préstamos`);
  if (deposits > 0)
    open.push(deposits === 1 ? "un plazo fijo" : `${deposits} plazos fijos`);
  if (applications > 0)
    open.push(
      applications === 1
        ? "una solicitud de tarjeta"
        : `${applications} solicitudes de tarjeta`,
    );
  if (open.length > 0) {
    return {
      ok: false,
      error: `${membership.student.name} todavía tiene ${open.join(", ")} con ${bank.name}. Primero hay que cerrarlos.`,
    };
  }

  await prisma.bankMembership.update({
    where: { id: membership.id },
    data: { endedAt: new Date() },
  });
  await prisma.notification.create({
    data: {
      userId: studentId,
      type: "GENERIC",
      title: `Te dieron de baja en ${bank.name}`,
      body: `Dejaste de ser cliente de ${bank.name}. Para volver a operar con ese banco tenés que adherirte de nuevo en el mostrador.`,
    },
  });

  revalidateMemberships();
  return {
    ok: true,
    message: `${membership.student.name} ya no es cliente de ${bank.name}.`,
  };
}
