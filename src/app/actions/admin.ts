"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import {
  issuanceSchema,
  depositSchema,
  invoiceSchema,
  editInvoiceSchema,
  createUserSchema,
  editUserSchema,
  groupSchema,
  prizeFineSchema,
  recurringSchema,
} from "@/lib/validations";
import { generateAlias, generateCvu } from "@/lib/utils";
import type { ActionResult } from "@/app/actions/student";

const D = (v: number | string) => new Prisma.Decimal(v);

/** Emisión monetaria: el admin crea dinero de la nada en su propia billetera. */
export async function issueMoney(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = issuanceSchema.safeParse({ amount: formData.get("amount") });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const amount = D(parsed.data.amount);
  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { userId: admin.id },
      data: { balance: { increment: amount } },
    });
    await tx.transaction.create({
      data: {
        type: "ISSUANCE",
        amount,
        description: "Emisión monetaria (Banco Central)",
        senderId: null,
        receiverId: admin.id,
      },
    });
  });

  revalidatePath("/admin");
  return {
    ok: true,
    message: `Emitiste ${parsed.data.amount.toFixed(2)} a tu billetera.`,
  };
}

/** Cargar saldo a un alumno (simula que entregó efectivo físico). */
export async function depositToStudent(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = depositSchema.safeParse({
    studentId: formData.get("studentId"),
    amount: formData.get("amount"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { studentId, amount, description } = parsed.data;
  const amountDec = D(amount);

  const student = await prisma.user.findUnique({
    where: { id: studentId },
    include: { wallet: true },
  });
  if (!student || !student.wallet)
    return { ok: false, error: "Alumno no encontrado." };

  try {
    await prisma.$transaction(async (tx) => {
      const adminWallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: admin.id },
      });
      if (adminWallet.balance.lessThan(amountDec)) {
        throw new Error("SALDO_INSUFICIENTE");
      }
      await tx.wallet.update({
        where: { userId: admin.id },
        data: { balance: { decrement: amountDec } },
      });
      await tx.wallet.update({
        where: { userId: studentId },
        data: { balance: { increment: amountDec } },
      });
      await tx.transaction.create({
        data: {
          type: "DEPOSIT",
          amount: amountDec,
          description: description?.trim() || "Carga de saldo",
          senderId: admin.id,
          receiverId: studentId,
        },
      });
      await tx.notification.create({
        data: {
          userId: studentId,
          type: "MONEY_RECEIVED",
          title: "¡Recibiste dinero!",
          body: `Se cargaron ${amount.toFixed(2)} a tu billetera.`,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "SALDO_INSUFICIENTE")
      return {
        ok: false,
        error: "No tenés saldo suficiente. Emití dinero primero.",
      };
    return { ok: false, error: "No se pudo cargar el saldo." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/students");
  return { ok: true, message: `Cargaste ${amount.toFixed(2)} a ${student.name}.` };
}

/** Crear facturas/servicios: a un grupo entero o a alumnos específicos. */
export async function createInvoices(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const studentIds = formData.getAll("studentIds").map(String).filter(Boolean);
  const parsed = invoiceSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    dueDate: formData.get("dueDate") || undefined,
    groupId: formData.get("groupId") || undefined,
    studentIds,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { description, amount, dueDate, groupId } = parsed.data;

  // Resolver la lista de alumnos objetivo.
  let targets: { id: string }[] = [];
  if (groupId && groupId !== "__none__") {
    targets = await prisma.user.findMany({
      where: { groupId, role: "STUDENT" },
      select: { id: true },
    });
  } else if (studentIds.length > 0) {
    targets = studentIds.map((id) => ({ id }));
  }

  if (targets.length === 0)
    return {
      ok: false,
      error: "Seleccioná un grupo o al menos un alumno.",
    };

  const due = dueDate ? new Date(dueDate) : null;
  const amountDec = D(amount);

  await prisma.$transaction(async (tx) => {
    for (const t of targets) {
      await tx.invoice.create({
        data: {
          description,
          amount: amountDec,
          dueDate: due,
          studentId: t.id,
          createdById: admin.id,
          status: "PENDING",
        },
      });
      await tx.notification.create({
        data: {
          userId: t.id,
          type: "NEW_INVOICE",
          title: "Nueva cuenta por pagar",
          body: `${description} — ${amount.toFixed(2)}`,
        },
      });
    }
  });

  revalidatePath("/admin/services");
  return {
    ok: true,
    message: `Se crearon ${targets.length} cobro(s) por ${amount.toFixed(2)}.`,
  };
}

/** Crear un alumno (o admin) con su billetera. */
export async function createUser(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    groupId: formData.get("groupId") || undefined,
    role: formData.get("role") || "STUDENT",
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { name, email, password, groupId, role } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { ok: false, error: "Ya existe un usuario con ese email." };

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      groupId: groupId && groupId !== "__none__" ? groupId : null,
      wallet: {
        create: {
          cvu: generateCvu(),
          alias: generateAlias(name),
          balance: 0,
        },
      },
    },
  });

  revalidatePath("/admin/students");
  return { ok: true, message: `${name} fue creado correctamente.` };
}

/** Editar datos de un usuario (opcionalmente su contraseña). */
export async function editUser(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = editUserSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    email: formData.get("email"),
    groupId: formData.get("groupId") || undefined,
    password: formData.get("password") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { userId, name, email, groupId, password } = parsed.data;

  const emailOwner = await prisma.user.findUnique({ where: { email } });
  if (emailOwner && emailOwner.id !== userId)
    return { ok: false, error: "Ese email ya está en uso." };

  const data: Prisma.UserUpdateInput = {
    name,
    email,
    group:
      groupId && groupId !== "__none__"
        ? { connect: { id: groupId } }
        : { disconnect: true },
  };
  if (password && password.length >= 4) {
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  await prisma.user.update({ where: { id: userId }, data });
  revalidatePath("/admin/students");
  return { ok: true, message: "Alumno actualizado." };
}

/** Crear un grupo (ej: 3A2026). */
export async function createGroup(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = groupSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const exists = await prisma.group.findUnique({
    where: { name: parsed.data.name },
  });
  if (exists) return { ok: false, error: "Ya existe un grupo con ese nombre." };

  await prisma.group.create({ data: { name: parsed.data.name } });
  revalidatePath("/admin/groups");
  revalidatePath("/admin/students");
  return { ok: true, message: `Grupo ${parsed.data.name} creado.` };
}

/** Editar un cobro pendiente (no se puede editar uno ya pagado). */
export async function editInvoice(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = editInvoiceSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { invoiceId, description, amount, dueDate } = parsed.data;
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { ok: false, error: "Cobro no encontrado." };
  if (invoice.status !== "PENDING")
    return {
      ok: false,
      error: "Solo se pueden editar cobros pendientes.",
    };

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      description,
      amount: D(amount),
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });

  revalidatePath("/admin/services");
  return { ok: true, message: "Cobro actualizado." };
}

/** Anular un cobro pendiente (queda registrado como CANCELLED). */
export async function cancelInvoice(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const invoiceId = String(formData.get("invoiceId") || "");
  if (!invoiceId) return { ok: false, error: "Cobro inválido." };

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { ok: false, error: "Cobro no encontrado." };
  if (invoice.status !== "PENDING")
    return { ok: false, error: "Solo se pueden anular cobros pendientes." };

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: "CANCELLED" },
    });
    await tx.notification.create({
      data: {
        userId: invoice.studentId,
        type: "GENERIC",
        title: "Cobro anulado",
        body: `El cobro "${invoice.description}" fue anulado por el profe.`,
      },
    });
  });

  revalidatePath("/admin/services");
  return { ok: true, message: "Cobro anulado." };
}

/** Premio (bonificación) o multa (descuento) a un alumno. */
export async function prizeOrFine(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = prizeFineSchema.safeParse({
    studentId: formData.get("studentId"),
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    reason: formData.get("reason"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { studentId, kind, amount, reason } = parsed.data;
  const amountDec = D(amount);
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    include: { wallet: true },
  });
  if (!student?.wallet) return { ok: false, error: "Alumno no encontrado." };

  try {
    await prisma.$transaction(async (tx) => {
      if (kind === "PRIZE") {
        // El banco paga el premio.
        await tx.wallet.update({
          where: { userId: admin.id },
          data: { balance: { decrement: amountDec } },
        });
        await tx.wallet.update({
          where: { userId: studentId },
          data: { balance: { increment: amountDec } },
        });
        await tx.transaction.create({
          data: {
            type: "PRIZE",
            amount: amountDec,
            description: `Premio: ${reason}`,
            category: "General",
            senderId: admin.id,
            receiverId: studentId,
          },
        });
        await tx.notification.create({
          data: {
            userId: studentId,
            type: "MONEY_RECEIVED",
            title: "🎉 ¡Recibiste un premio!",
            body: `${reason} (+${amount.toFixed(2)})`,
          },
        });
      } else {
        // Multa: se descuenta del alumno hacia el banco.
        const sw = await tx.wallet.findUniqueOrThrow({
          where: { userId: studentId },
        });
        if (sw.balance.lessThan(amountDec)) throw new Error("SALDO_INSUFICIENTE");
        await tx.wallet.update({
          where: { userId: studentId },
          data: { balance: { decrement: amountDec } },
        });
        await tx.wallet.update({
          where: { userId: admin.id },
          data: { balance: { increment: amountDec } },
        });
        await tx.transaction.create({
          data: {
            type: "FINE",
            amount: amountDec,
            description: `Multa: ${reason}`,
            category: "General",
            senderId: studentId,
            receiverId: admin.id,
          },
        });
        await tx.notification.create({
          data: {
            userId: studentId,
            type: "GENERIC",
            title: "⚠️ Te aplicaron una multa",
            body: `${reason} (−${amount.toFixed(2)})`,
          },
        });
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "SALDO_INSUFICIENTE")
      return {
        ok: false,
        error: "El alumno no tiene saldo suficiente para la multa.",
      };
    return { ok: false, error: "No se pudo aplicar la operación." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/students");
  return {
    ok: true,
    message:
      kind === "PRIZE"
        ? `Premiaste a ${student.name} con ${amount.toFixed(2)}.`
        : `Multaste a ${student.name} por ${amount.toFixed(2)}.`,
  };
}

/** Crear un cobro recurrente programado. */
export async function createRecurring(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = recurringSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    intervalDays: formData.get("intervalDays"),
    groupId: formData.get("groupId"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  await prisma.recurringCharge.create({
    data: {
      description: parsed.data.description,
      amount: D(parsed.data.amount),
      intervalDays: parsed.data.intervalDays,
      groupId: parsed.data.groupId,
      createdById: admin.id,
      nextRunAt: new Date(), // disponible para generar de inmediato
    },
  });
  revalidatePath("/admin/recurring");
  return { ok: true, message: "Cobro recurrente programado." };
}

export async function toggleRecurring(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const id = String(formData.get("recurringId") || "");
  const rc = await prisma.recurringCharge.findUnique({ where: { id } });
  if (!rc) return { ok: false, error: "No encontrado." };
  await prisma.recurringCharge.update({
    where: { id },
    data: { active: !rc.active },
  });
  revalidatePath("/admin/recurring");
  return { ok: true, message: rc.active ? "Pausado." : "Reactivado." };
}

/** Genera los cobros recurrentes vencidos (crea Invoices y adelanta nextRunAt). */
export async function runRecurringNow(
  _prev: ActionResult | null,
  _formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const now = new Date();

  const due = await prisma.recurringCharge.findMany({
    where: { active: true, nextRunAt: { lte: now }, groupId: { not: null } },
  });
  if (due.length === 0)
    return { ok: false, error: "No hay cobros recurrentes para generar." };

  let created = 0;
  for (const rc of due) {
    const students = await prisma.user.findMany({
      where: { groupId: rc.groupId!, role: "STUDENT" },
      select: { id: true },
    });
    await prisma.$transaction(async (tx) => {
      for (const s of students) {
        await tx.invoice.create({
          data: {
            description: rc.description,
            amount: rc.amount,
            studentId: s.id,
            createdById: admin.id,
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
        created++;
      }
      const next = new Date();
      next.setDate(next.getDate() + rc.intervalDays);
      await tx.recurringCharge.update({
        where: { id: rc.id },
        data: { lastRunAt: now, nextRunAt: next },
      });
    });
  }

  revalidatePath("/admin/recurring");
  revalidatePath("/admin/services");
  return { ok: true, message: `Se generaron ${created} cobro(s).` };
}
