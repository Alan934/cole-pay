"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireBankAdminSession } from "@/lib/session";
import {
  assignEmployeesSchema,
  bankSchema,
  createUserSchema,
  editBankSchema,
  fundBankSchema,
} from "@/lib/validations";
import { generateAlias, generateCvu } from "@/lib/utils";
import type { ActionResult } from "@/app/actions/student";

/**
 * Administración de bancos. Entran acá la profe de quinto (BANK_ADMIN) y el
 * admin general; el chequeo lo hace `requireBankAdminSession`.
 *
 * Cada banco tiene una cuenta propia —un `User` con rol BANK y su billetera—
 * para que sus movimientos usen el mismo libro mayor que los de los alumnos.
 * Esa cuenta no inicia sesión: la operan los empleados del banco.
 */

const D = (v: number | string) => new Prisma.Decimal(v);

/** "Banco del Sol" -> "banco-del-sol" */
function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca los acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

/** Slug libre: si "banco-del-sol" ya existe, prueba con -2, -3, etc. */
async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "banco";
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const taken = await prisma.bank.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!taken) return slug;
  }
  throw new Error("No se pudo generar un identificador para el banco.");
}

function parseBankForm(formData: FormData) {
  return {
    name: formData.get("name"),
    color: formData.get("color") || "#4f46e5",
    defaultLimit: formData.get("defaultLimit"),
    monthlyRatePct: formData.get("monthlyRatePct"),
    closingDay: formData.get("closingDay"),
    dueDays: formData.get("dueDays"),
  };
}

/** Crea un banco junto con su cuenta operativa y su billetera. */
export async function createBank(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireBankAdminSession();
  const parsed = bankSchema.safeParse(parseBankForm(formData));
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { name, color, defaultLimit, monthlyRatePct, closingDay, dueDays } =
    parsed.data;

  const exists = await prisma.bank.findUnique({ where: { name } });
  if (exists) return { ok: false, error: "Ya existe un banco con ese nombre." };

  const slug = await uniqueSlug(name);
  // La cuenta del banco no se usa para entrar al sistema; le ponemos un hash
  // de una contraseña aleatoria que nadie conoce.
  const passwordHash = await bcrypt.hash(
    `${slug}-${Math.random().toString(36).slice(2)}`,
    10,
  );

  await prisma.$transaction(async (tx) => {
    const account = await tx.user.create({
      data: {
        name,
        email: `${slug}@banco.colepay.local`,
        passwordHash,
        role: "BANK",
        wallet: {
          create: { cvu: generateCvu(), alias: generateAlias(slug), balance: 0 },
        },
      },
    });
    await tx.bank.create({
      data: {
        name,
        slug,
        color,
        defaultLimit: D(defaultLimit),
        monthlyRatePct: D(monthlyRatePct),
        closingDay,
        dueDays,
        accountId: account.id,
      },
    });
  });

  revalidatePath("/admin/banks");
  return { ok: true, message: `Banco ${name} creado.` };
}

/** Edita el nombre, el color y la política de crédito de un banco. */
export async function editBank(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireBankAdminSession();
  const parsed = editBankSchema.safeParse({
    ...parseBankForm(formData),
    bankId: formData.get("bankId"),
    active: formData.get("active"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const {
    bankId,
    name,
    color,
    active,
    defaultLimit,
    monthlyRatePct,
    closingDay,
    dueDays,
  } = parsed.data;

  const bank = await prisma.bank.findUnique({ where: { id: bankId } });
  if (!bank) return { ok: false, error: "No se encontró el banco." };

  const nameOwner = await prisma.bank.findUnique({ where: { name } });
  if (nameOwner && nameOwner.id !== bankId)
    return { ok: false, error: "Ya existe otro banco con ese nombre." };

  await prisma.$transaction(async (tx) => {
    await tx.bank.update({
      where: { id: bankId },
      data: {
        name,
        color,
        active,
        defaultLimit: D(defaultLimit),
        monthlyRatePct: D(monthlyRatePct),
        closingDay,
        dueDays,
      },
    });
    // La cuenta operativa se llama igual que el banco: así aparece con el
    // nombre correcto en los comprobantes de los alumnos.
    if (name !== bank.name) {
      await tx.user.update({ where: { id: bank.accountId }, data: { name } });
    }
  });

  revalidatePath("/admin/banks");
  revalidatePath(`/admin/banks/${bankId}`);
  revalidatePath("/bank");
  return { ok: true, message: "Banco actualizado." };
}

/**
 * Suma capital a un banco. Es una emisión del Banco Central dirigida a la
 * cuenta del banco: sin fondos no puede pagarle a los comercios cuando sus
 * clientes usan la tarjeta.
 */
export async function fundBank(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireBankAdminSession();
  const parsed = fundBankSchema.safeParse({
    bankId: formData.get("bankId"),
    amount: formData.get("amount"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { bankId, amount, description } = parsed.data;
  const bank = await prisma.bank.findUnique({ where: { id: bankId } });
  if (!bank) return { ok: false, error: "No se encontró el banco." };

  const amountDec = D(amount);
  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { userId: bank.accountId },
      data: { balance: { increment: amountDec } },
    });
    await tx.transaction.create({
      data: {
        type: "BANK_FUNDING",
        amount: amountDec,
        description: description?.trim() || `Capitalización de ${bank.name}`,
        senderId: null,
        receiverId: bank.accountId,
      },
    });
  });

  revalidatePath("/admin/banks");
  revalidatePath(`/admin/banks/${bankId}`);
  revalidatePath("/bank");
  return {
    ok: true,
    message: `Le cargaste ${amount.toFixed(2)} a ${bank.name}.`,
  };
}

/** Suma uno o varios alumnos de quinto a un banco. */
export async function assignEmployees(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireBankAdminSession();
  const parsed = assignEmployeesSchema.safeParse({
    bankId: formData.get("bankId"),
    userIds: formData.getAll("userIds").map(String).filter(Boolean),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { bankId, userIds } = parsed.data;
  const bank = await prisma.bank.findUnique({ where: { id: bankId } });
  if (!bank) return { ok: false, error: "No se encontró el banco." };

  // Sólo se mueven empleados: un alumno de tercero no puede terminar
  // atendiendo el mostrador por un id mal enviado.
  const { count } = await prisma.user.updateMany({
    where: { id: { in: userIds }, role: "BANK_EMPLOYEE" },
    data: { bankId },
  });

  revalidatePath("/admin/banks");
  revalidatePath(`/admin/banks/${bankId}`);
  return count === 0
    ? { ok: false, error: "Ninguno de los alumnos elegidos es de quinto año." }
    : {
        ok: true,
        message: `${count} ${count === 1 ? "alumno asignado" : "alumnos asignados"} a ${bank.name}.`,
      };
}

/** Saca a un empleado del banco (queda sin banco asignado). */
export async function removeEmployee(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireBankAdminSession();
  const userId = String(formData.get("userId") || "");
  if (!userId) return { ok: false, error: "Alumno inválido." };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "BANK_EMPLOYEE")
    return { ok: false, error: "No se encontró el empleado." };

  await prisma.user.update({ where: { id: userId }, data: { bankId: null } });

  revalidatePath("/admin/banks");
  if (user.bankId) revalidatePath(`/admin/banks/${user.bankId}`);
  return { ok: true, message: `${user.name} quedó sin banco.` };
}

/**
 * Crea un alumno de quinto año (o la profe de quinto). No lleva billetera:
 * su rol es atender el banco, no operar una cuenta personal.
 */
export async function createBankUser(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireBankAdminSession();
  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    dni: formData.get("dni") || undefined,
    cuit: formData.get("cuit") || undefined,
    password: formData.get("password"),
    role: formData.get("role") || "BANK_EMPLOYEE",
    bankId: formData.get("bankId") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { name, email, dni, cuit, password, role, bankId } = parsed.data;
  if (role !== "BANK_EMPLOYEE" && role !== "BANK_ADMIN") {
    return {
      ok: false,
      error: "Desde acá sólo se crean usuarios de quinto año.",
    };
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { ok: false, error: "Ya existe un usuario con ese email." };
  if (dni) {
    const owner = await prisma.user.findUnique({ where: { dni } });
    if (owner) return { ok: false, error: "Ya existe un usuario con ese DNI." };
  }
  if (cuit) {
    const owner = await prisma.user.findUnique({ where: { cuit } });
    if (owner) return { ok: false, error: "Ya existe un usuario con ese CUIT." };
  }

  const bank =
    role === "BANK_EMPLOYEE" && bankId && bankId !== "__none__"
      ? await prisma.bank.findUnique({ where: { id: bankId } })
      : null;
  if (role === "BANK_EMPLOYEE" && bankId && bankId !== "__none__" && !bank) {
    return { ok: false, error: "No se encontró el banco elegido." };
  }

  await prisma.user.create({
    data: {
      name,
      email,
      dni: dni ?? null,
      cuit: cuit ?? null,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      bankId: bank?.id ?? null,
    },
  });

  revalidatePath("/admin/banks");
  if (bank) revalidatePath(`/admin/banks/${bank.id}`);
  return {
    ok: true,
    message: bank
      ? `${name} fue creado y asignado a ${bank.name}.`
      : `${name} fue creado.`,
  };
}
