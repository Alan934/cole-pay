"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireBankStaff, requireStudent } from "@/lib/session";
import {
  approveApplicationSchema,
  cardApplicationSchema,
  payStatementSchema,
  rejectApplicationSchema,
  transferSchema,
  updateCardSchema,
} from "@/lib/validations";
import {
  cardBalance,
  closeStatements,
  defaultExpiry,
  generateCvv,
  generateUniqueCardNumber,
  isExpired,
  luhnValid,
  type CardBrandName,
} from "@/lib/cards";
import { formatMoney } from "@/lib/utils";
import { isAdhered, notAdheredMessage } from "@/lib/memberships";
import type { ActionResult } from "@/app/actions/student";

/**
 * Circuito de la tarjeta de crédito.
 *
 * El alumno de tercero le pide la tarjeta a un banco, el banco (alumnos de
 * quinto) la aprueba y le carga los datos, y a partir de ahí el alumno puede
 * comprar a crédito: el banco le paga al comercio en el momento y le queda
 * debiendo. Después el banco cierra el resumen y el alumno lo paga.
 */

const D = (v: number | string) => new Prisma.Decimal(v);

/* --------------------------------- Alumno --------------------------------- */

/** El alumno solicita una tarjeta a un banco. */
export async function applyForCard(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const parsed = cardApplicationSchema.safeParse({
    bankId: formData.get("bankId"),
    requestedLimit: formData.get("requestedLimit"),
    monthlyIncome: formData.get("monthlyIncome") || undefined,
    purpose: formData.get("purpose") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { bankId, requestedLimit, monthlyIncome, purpose } = parsed.data;

  const bank = await prisma.bank.findUnique({
    where: { id: bankId },
    select: { id: true, name: true, active: true },
  });
  if (!bank) return { ok: false, error: "No se encontró el banco." };
  if (!bank.active)
    return { ok: false, error: `${bank.name} no está recibiendo solicitudes.` };
  if (!(await isAdhered(me.id, bankId)))
    return { ok: false, error: notAdheredMessage(bank.name) };

  const [pending, active] = await Promise.all([
    prisma.cardApplication.findFirst({
      where: { applicantId: me.id, bankId, status: "PENDING" },
      select: { id: true },
    }),
    prisma.creditCard.findFirst({
      where: { ownerId: me.id, bankId, status: { in: ["ACTIVE", "BLOCKED"] } },
      select: { id: true },
    }),
  ]);
  if (pending)
    return {
      ok: false,
      error: `Ya tenés una solicitud esperando respuesta en ${bank.name}.`,
    };
  if (active)
    return { ok: false, error: `Ya tenés una tarjeta de ${bank.name}.` };

  await prisma.$transaction(async (tx) => {
    await tx.cardApplication.create({
      data: {
        applicantId: me.id,
        bankId,
        requestedLimit: D(requestedLimit),
        monthlyIncome:
          monthlyIncome === undefined ? null : D(monthlyIncome),
        purpose: purpose?.trim() || null,
      },
    });

    // Aviso a los empleados del banco para que la atiendan.
    const staff = await tx.user.findMany({
      where: { role: "BANK_EMPLOYEE", bankId },
      select: { id: true },
    });
    if (staff.length > 0) {
      await tx.notification.createMany({
        data: staff.map((s) => ({
          userId: s.id,
          type: "CARD_APPLICATION" as const,
          title: "Nueva solicitud de tarjeta",
          body: `${me.name} pidió una tarjeta con un límite de ${formatMoney(requestedLimit)}.`,
        })),
      });
    }
  });

  revalidatePath("/cards");
  revalidatePath("/bank");
  revalidatePath("/bank/applications");
  return {
    ok: true,
    message: `Enviaste la solicitud a ${bank.name}. Ahora la tiene que revisar el banco.`,
  };
}

/** El alumno da de baja su propia solicitud mientras nadie la revisó. */
export async function cancelApplication(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const applicationId = String(formData.get("applicationId") || "");

  const app = await prisma.cardApplication.findUnique({
    where: { id: applicationId },
  });
  if (!app || app.applicantId !== me.id)
    return { ok: false, error: "No se encontró la solicitud." };
  if (app.status !== "PENDING")
    return { ok: false, error: "El banco ya respondió esta solicitud." };

  await prisma.cardApplication.update({
    where: { id: applicationId },
    data: { status: "CANCELLED", reviewedAt: new Date() },
  });

  revalidatePath("/cards");
  revalidatePath("/bank/applications");
  return { ok: true, message: "Diste de baja la solicitud." };
}

/** El alumno paga un resumen (total o una parte) desde su billetera. */
export async function payStatement(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const parsed = payStatementSchema.safeParse({
    statementId: formData.get("statementId"),
    amount: formData.get("amount"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { statementId, amount } = parsed.data;
  const amountDec = D(amount);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const statement = await tx.cardStatement.findUnique({
        where: { id: statementId },
        include: {
          card: { include: { bank: { select: { name: true, accountId: true } } } },
        },
      });
      if (!statement || statement.card.ownerId !== me.id)
        throw new Error("NO_ENCONTRADO");
      if (statement.status === "PAID") throw new Error("YA_PAGADO");
      if (statement.status === "ROLLED") throw new Error("ARRASTRADO");

      const remaining = statement.total.minus(statement.paid);
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
        where: { userId: statement.card.bank.accountId },
        data: { balance: { increment: amountDec } },
      });

      const movement = await tx.transaction.create({
        data: {
          type: "CARD_PAYMENT",
          amount: amountDec,
          description: `Pago de tarjeta ••••${statement.card.last4} — ${statement.card.bank.name}`,
          category: "Servicios",
          senderId: me.id,
          receiverId: statement.card.bank.accountId,
        },
      });

      await tx.cardPayment.create({
        data: {
          cardId: statement.cardId,
          statementId: statement.id,
          amount: amountDec,
          transactionId: movement.id,
        },
      });

      const paid = statement.paid.plus(amountDec);
      const settled = paid.greaterThanOrEqualTo(statement.total);
      await tx.cardStatement.update({
        where: { id: statement.id },
        data: {
          paid,
          status: settled ? "PAID" : statement.status,
          paidAt: settled ? new Date() : null,
        },
      });

      return { settled, left: statement.total.minus(paid) };
    });

    revalidatePath("/cards");
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    revalidatePath("/bank");
    return {
      ok: true,
      message: result.settled
        ? "Pagaste todo el resumen. ¡Cero deuda con el banco!"
        : `Pago registrado. Te quedan ${formatMoney(Number(result.left))} de este resumen.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "SALDO_INSUFICIENTE")
      return { ok: false, error: "No te alcanza el saldo para ese pago." };
    if (msg === "MONTO_EXCEDE")
      return { ok: false, error: "El monto es mayor a lo que debés." };
    if (msg === "YA_PAGADO")
      return { ok: false, error: "Este resumen ya está pagado." };
    if (msg === "ARRASTRADO")
      return {
        ok: false,
        error: "El saldo de este resumen pasó al resumen siguiente.",
      };
    if (msg === "NO_ENCONTRADO")
      return { ok: false, error: "No se encontró el resumen." };
    return { ok: false, error: "No se pudo registrar el pago." };
  }
}

/**
 * Consumo con tarjeta. Lo llama `transferMoney` cuando el alumno elige pagar
 * con la tarjeta en vez de con el saldo: el banco le paga al comercio en el
 * acto y el consumo queda como deuda del alumno.
 */
export async function payWithCard(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const parsed = transferSchema.safeParse({
    destination: formData.get("destination"),
    amount: formData.get("amount"),
    description: formData.get("description") || undefined,
    category: formData.get("category") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { destination, amount, description, category } = parsed.data;
  const cardId = String(formData.get("cardId") || "");
  const requestId = String(formData.get("req") || "");
  const amountDec = D(amount);

  const destWallet = await prisma.wallet.findFirst({
    where: {
      OR: [{ alias: destination.trim().toLowerCase() }, { cvu: destination.trim() }],
    },
    include: { user: { select: { id: true, name: true, role: true } } },
  });
  if (!destWallet)
    return { ok: false, error: "No se encontró una cuenta con ese CVU o alias." };
  if (destWallet.userId === me.id)
    return { ok: false, error: "No podés pagarte a vos mismo." };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const card = await tx.creditCard.findUnique({
        where: { id: cardId },
        include: {
          bank: { select: { name: true, accountId: true } },
          charges: { where: { statementId: null }, select: { amount: true, statementId: true } },
          statements: {
            where: { status: { in: ["CLOSED", "OVERDUE"] } },
            select: { status: true, total: true, paid: true },
          },
        },
      });
      if (!card || card.ownerId !== me.id) throw new Error("NO_ENCONTRADA");
      if (card.status !== "ACTIVE") throw new Error("INACTIVA");
      if (isExpired(card)) throw new Error("VENCIDA");
      if (destWallet.userId === card.bank.accountId)
        throw new Error("AL_BANCO");

      const balance = cardBalance(card);
      if (amountDec.greaterThan(D(balance.available)))
        throw new Error("SIN_LIMITE");

      // El banco adelanta la plata: si no tiene fondos, la compra se rechaza,
      // igual que cuando un banco real no autoriza la operación.
      const bankWallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: card.bank.accountId },
      });
      if (bankWallet.balance.lessThan(amountDec)) throw new Error("BANCO_SIN_FONDOS");

      await tx.wallet.update({
        where: { userId: card.bank.accountId },
        data: { balance: { decrement: amountDec } },
      });
      await tx.wallet.update({
        where: { userId: destWallet.userId },
        data: { balance: { increment: amountDec } },
      });

      const label = description?.trim() || "Compra con tarjeta";
      const movement = await tx.transaction.create({
        data: {
          type: "CARD_PURCHASE",
          amount: amountDec,
          description: `${label} (tarjeta ••••${card.last4} de ${me.name})`,
          category: category?.trim() || "General",
          senderId: card.bank.accountId,
          receiverId: destWallet.userId,
        },
      });

      await tx.cardCharge.create({
        data: {
          cardId: card.id,
          kind: "PURCHASE",
          amount: amountDec,
          description: `${label} — ${destWallet.user.name}`,
          category: category?.trim() || "General",
          merchantId: destWallet.userId,
          transactionId: movement.id,
        },
      });

      await tx.notification.create({
        data: {
          userId: destWallet.userId,
          type: "MONEY_RECEIVED",
          title: "¡Recibiste un pago con tarjeta!",
          body: `${me.name} te pagó ${formatMoney(amount)} con tarjeta de ${card.bank.name}.`,
        },
      });

      if (requestId) {
        const req = await tx.paymentRequest.findUnique({
          where: { id: requestId },
        });
        if (req && req.status === "PENDING" && req.requesterId === destWallet.userId) {
          await tx.paymentRequest.update({
            where: { id: requestId },
            data: { status: "PAID", paidAt: new Date(), payerId: me.id },
          });
        }
      }

      return { available: D(balance.available).minus(amountDec) };
    });

    revalidatePath("/cards");
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    revalidatePath("/transfer");
    return {
      ok: true,
      message: `Pagaste ${formatMoney(amount)} a ${destWallet.user.name} con la tarjeta. Te queda ${formatMoney(Number(result.available))} de límite disponible.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NO_ENCONTRADA")
      return { ok: false, error: "No se encontró esa tarjeta." };
    if (msg === "INACTIVA")
      return { ok: false, error: "La tarjeta está bloqueada o dada de baja." };
    if (msg === "VENCIDA") return { ok: false, error: "La tarjeta está vencida." };
    if (msg === "SIN_LIMITE")
      return {
        ok: false,
        error: "No te alcanza el límite disponible. Pagá el resumen para liberar crédito.",
      };
    if (msg === "BANCO_SIN_FONDOS")
      return {
        ok: false,
        error: "El banco no tiene fondos para autorizar la compra. Avisale al banco.",
      };
    if (msg === "AL_BANCO")
      return {
        ok: false,
        error: "Para pagarle al banco usá el pago del resumen, no la tarjeta.",
      };
    return { ok: false, error: "No se pudo completar la compra." };
  }
}

/* ---------------------------------- Banco --------------------------------- */

/**
 * Un empleado sólo toca su propio banco; la profe de quinto y el admin pueden
 * intervenir en cualquiera cuando el banco no responde.
 */
function canOperate(
  staff: { role: string; bankId: string | null },
  bankId: string,
): boolean {
  if (staff.role === "ADMIN" || staff.role === "BANK_ADMIN") return true;
  return staff.bankId === bankId;
}

/** El banco aprueba la solicitud y emite la tarjeta. */
export async function approveApplication(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const staff = await requireBankStaff();
  const parsed = approveApplicationSchema.safeParse({
    applicationId: formData.get("applicationId"),
    creditLimit: formData.get("creditLimit"),
    brand: formData.get("brand") || "VISA",
    mode: formData.get("mode") || "auto",
    holderName: formData.get("holderName") || undefined,
    number: formData.get("number") || undefined,
    expMonth: formData.get("expMonth") || undefined,
    expYear: formData.get("expYear") || undefined,
    cvv: formData.get("cvv") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { applicationId, creditLimit, brand, mode, note } = parsed.data;

  const app = await prisma.cardApplication.findUnique({
    where: { id: applicationId },
    include: {
      applicant: { select: { id: true, name: true } },
      bank: true,
    },
  });
  if (!app) return { ok: false, error: "No se encontró la solicitud." };
  if (!canOperate(staff, app.bankId))
    return { ok: false, error: "Esa solicitud es de otro banco." };
  if (app.status !== "PENDING")
    return { ok: false, error: "Esta solicitud ya fue resuelta." };

  // Datos de la tarjeta: los carga el banco o los inventa el sistema.
  let number: string;
  let expMonth: number;
  let expYear: number;
  let cvv: string;
  let holderName: string;

  if (mode === "manual") {
    number = parsed.data.number!;
    expMonth = parsed.data.expMonth!;
    expYear = parsed.data.expYear!;
    cvv = parsed.data.cvv!;
    holderName = parsed.data.holderName!.toUpperCase();

    if (!luhnValid(number)) {
      return {
        ok: false,
        error:
          "Ese número no pasa la validación de Luhn. Revisá los dígitos o usá el modo automático.",
      };
    }
    const taken = await prisma.creditCard.findUnique({
      where: { number },
      select: { id: true },
    });
    if (taken)
      return { ok: false, error: "Ya hay una tarjeta con ese número." };
  } else {
    number = await generateUniqueCardNumber(brand as CardBrandName);
    const exp = defaultExpiry();
    expMonth = exp.expMonth;
    expYear = exp.expYear;
    cvv = generateCvv();
    holderName = app.applicant.name.toUpperCase();
  }

  await prisma.$transaction(async (tx) => {
    await tx.creditCard.create({
      data: {
        brand,
        number,
        last4: number.slice(-4),
        holderName,
        expMonth,
        expYear,
        cvv,
        creditLimit: D(creditLimit),
        closingDay: app.bank.closingDay,
        dueDays: app.bank.dueDays,
        monthlyRatePct: app.bank.monthlyRatePct,
        ownerId: app.applicantId,
        bankId: app.bankId,
        issuedById: staff.id,
        applicationId: app.id,
      },
    });
    await tx.cardApplication.update({
      where: { id: app.id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: staff.id,
        reviewNote: note?.trim() || null,
      },
    });
    await tx.notification.create({
      data: {
        userId: app.applicantId,
        type: "CARD_APPROVED",
        title: "¡Te aprobaron la tarjeta!",
        body: `${app.bank.name} te emitió una tarjeta ••••${number.slice(-4)} con un límite de ${formatMoney(creditLimit)}.`,
      },
    });
  });

  revalidatePath("/bank");
  revalidatePath("/bank/applications");
  revalidatePath("/bank/cards");
  revalidatePath("/admin/cards");
  revalidatePath("/cards");
  return {
    ok: true,
    message: `Tarjeta emitida a ${app.applicant.name} (••••${number.slice(-4)}).`,
  };
}

/** El banco rechaza la solicitud, con motivo. */
export async function rejectApplication(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const staff = await requireBankStaff();
  const parsed = rejectApplicationSchema.safeParse({
    applicationId: formData.get("applicationId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { applicationId, reason } = parsed.data;
  const app = await prisma.cardApplication.findUnique({
    where: { id: applicationId },
    include: { bank: { select: { name: true } } },
  });
  if (!app) return { ok: false, error: "No se encontró la solicitud." };
  if (!canOperate(staff, app.bankId))
    return { ok: false, error: "Esa solicitud es de otro banco." };
  if (app.status !== "PENDING")
    return { ok: false, error: "Esta solicitud ya fue resuelta." };

  await prisma.$transaction(async (tx) => {
    await tx.cardApplication.update({
      where: { id: app.id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: staff.id,
        reviewNote: reason,
      },
    });
    await tx.notification.create({
      data: {
        userId: app.applicantId,
        type: "CARD_REJECTED",
        title: "Rechazaron tu solicitud de tarjeta",
        body: `${app.bank.name} no aprobó tu solicitud. Motivo: ${reason}`,
      },
    });
  });

  revalidatePath("/bank");
  revalidatePath("/bank/applications");
  revalidatePath("/admin/cards");
  revalidatePath("/cards");
  return { ok: true, message: "Solicitud rechazada." };
}

/** Cambia el límite o el estado (activa / bloqueada / dada de baja). */
export async function updateCard(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const staff = await requireBankStaff();
  const parsed = updateCardSchema.safeParse({
    cardId: formData.get("cardId"),
    creditLimit: formData.get("creditLimit"),
    status: formData.get("status"),
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const { cardId, creditLimit, status } = parsed.data;
  const card = await prisma.creditCard.findUnique({
    where: { id: cardId },
    include: {
      owner: { select: { id: true, name: true } },
      charges: { where: { statementId: null }, select: { amount: true, statementId: true } },
      statements: {
        where: { status: { in: ["CLOSED", "OVERDUE"] } },
        select: { status: true, total: true, paid: true },
      },
    },
  });
  if (!card) return { ok: false, error: "No se encontró la tarjeta." };
  if (!canOperate(staff, card.bankId))
    return { ok: false, error: "Esa tarjeta es de otro banco." };

  const balance = cardBalance(card);
  if (creditLimit < balance.debt) {
    return {
      ok: false,
      error: `No podés bajar el límite por debajo de la deuda actual (${formatMoney(balance.debt)}).`,
    };
  }
  if (status === "CANCELLED" && balance.debt > 0) {
    return {
      ok: false,
      error: `No se puede dar de baja una tarjeta con deuda (${formatMoney(balance.debt)}). Bloqueala hasta que pague.`,
    };
  }

  await prisma.creditCard.update({
    where: { id: cardId },
    data: { creditLimit: D(creditLimit), status },
  });

  revalidatePath("/bank/cards");
  revalidatePath("/admin/cards");
  revalidatePath("/cards");
  return { ok: true, message: `Tarjeta de ${card.owner.name} actualizada.` };
}

/**
 * Cierra el período y emite el resumen. Sin `cardId` cierra todas las tarjetas
 * del banco: es el "cierre de mes" que hacen los alumnos de quinto en clase,
 * sin esperar a que llegue la fecha real.
 */
export async function closeBankPeriod(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const staff = await requireBankStaff();
  const cardId = String(formData.get("cardId") || "");
  const bankId = String(formData.get("bankId") || staff.bankId || "");

  if (!bankId) return { ok: false, error: "Elegí un banco." };
  if (!canOperate(staff, bankId))
    return { ok: false, error: "Ese banco no es el tuyo." };

  const cards = await prisma.creditCard.findMany({
    where: {
      bankId,
      status: { in: ["ACTIVE", "BLOCKED"] },
      ...(cardId ? { id: cardId } : {}),
    },
    select: { id: true },
  });
  if (cards.length === 0)
    return { ok: false, error: "No hay tarjetas para cerrar." };

  const result = await closeStatements({
    cardIds: cards.map((c) => c.id),
    force: true,
  });

  revalidatePath("/bank");
  revalidatePath("/bank/cards");
  revalidatePath("/admin/cards");
  revalidatePath("/cards");

  if (result.closed === 0) {
    return {
      ok: true,
      message: "No había consumos ni saldo para facturar: no se emitió ningún resumen.",
    };
  }
  return {
    ok: true,
    message: `Cerraste ${result.closed} ${result.closed === 1 ? "resumen" : "resúmenes"}.`,
  };
}

/**
 * Pago de una factura del sistema con la tarjeta. Igual que un consumo: el
 * banco le paga al profe en el acto y el alumno le queda debiendo al banco.
 */
export async function payInvoiceWithCard(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const invoiceId = String(formData.get("invoiceId") || "");
  const cardId = String(formData.get("cardId") || "");
  if (!invoiceId) return { ok: false, error: "Factura inválida." };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { createdBy: { select: { id: true, name: true } } },
      });
      if (!invoice || invoice.studentId !== me.id)
        throw new Error("NO_ENCONTRADA");
      if (invoice.status !== "PENDING") throw new Error("YA_PAGADA");

      const card = await tx.creditCard.findUnique({
        where: { id: cardId },
        include: {
          bank: { select: { name: true, accountId: true } },
          charges: {
            where: { statementId: null },
            select: { amount: true, statementId: true },
          },
          statements: {
            where: { status: { in: ["CLOSED", "OVERDUE"] } },
            select: { status: true, total: true, paid: true },
          },
        },
      });
      if (!card || card.ownerId !== me.id) throw new Error("NO_ENCONTRADA_TC");
      if (card.status !== "ACTIVE") throw new Error("INACTIVA");
      if (isExpired(card)) throw new Error("VENCIDA");

      const balance = cardBalance(card);
      if (invoice.amount.greaterThan(D(balance.available)))
        throw new Error("SIN_LIMITE");

      // Cuenta que recibe el pago: el profe que emitió la factura.
      let adminId = invoice.createdById;
      if (!adminId) {
        const anyAdmin = await tx.user.findFirst({ where: { role: "ADMIN" } });
        adminId = anyAdmin?.id ?? null;
      }
      if (!adminId) throw new Error("SIN_DESTINO");

      const bankWallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: card.bank.accountId },
      });
      if (bankWallet.balance.lessThan(invoice.amount))
        throw new Error("BANCO_SIN_FONDOS");

      await tx.wallet.update({
        where: { userId: card.bank.accountId },
        data: { balance: { decrement: invoice.amount } },
      });
      await tx.wallet.update({
        where: { userId: adminId },
        data: { balance: { increment: invoice.amount } },
      });

      const movement = await tx.transaction.create({
        data: {
          type: "CARD_PURCHASE",
          amount: invoice.amount,
          description: `Pago: ${invoice.description} (tarjeta ••••${card.last4} de ${me.name})`,
          category: "Servicios",
          senderId: card.bank.accountId,
          receiverId: adminId,
        },
      });

      await tx.cardCharge.create({
        data: {
          cardId: card.id,
          kind: "PURCHASE",
          amount: invoice.amount,
          description: `Pago: ${invoice.description}`,
          category: "Servicios",
          merchantId: adminId,
          transactionId: movement.id,
        },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          transactionId: movement.id,
        },
      });

      await tx.notification.create({
        data: {
          userId: adminId,
          type: "INVOICE_PAID",
          title: "Factura pagada",
          body: `${me.name} pagó "${invoice.description}" con tarjeta de ${card.bank.name}.`,
        },
      });

      return { description: invoice.description };
    });

    revalidatePath("/bills");
    revalidatePath("/cards");
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    return {
      ok: true,
      message: `Pagaste "${result.description}" con la tarjeta.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NO_ENCONTRADA")
      return { ok: false, error: "No se encontró la factura." };
    if (msg === "YA_PAGADA")
      return { ok: false, error: "Esta factura ya fue pagada." };
    if (msg === "NO_ENCONTRADA_TC")
      return { ok: false, error: "No se encontró esa tarjeta." };
    if (msg === "INACTIVA")
      return { ok: false, error: "La tarjeta está bloqueada o dada de baja." };
    if (msg === "VENCIDA")
      return { ok: false, error: "La tarjeta está vencida." };
    if (msg === "SIN_LIMITE")
      return {
        ok: false,
        error: "No te alcanza el límite de la tarjeta para esta cuenta.",
      };
    if (msg === "BANCO_SIN_FONDOS")
      return {
        ok: false,
        error: "El banco no tiene fondos para autorizar el pago.",
      };
    if (msg === "SIN_DESTINO")
      return { ok: false, error: "No hay una cuenta que reciba el pago." };
    return { ok: false, error: "No se pudo procesar el pago." };
  }
}
