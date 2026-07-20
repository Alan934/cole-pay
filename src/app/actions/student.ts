"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/session";
import { transferSchema, aliasSchema } from "@/lib/validations";

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

const D = (v: number | string) => new Prisma.Decimal(v);

/** Transferencia alumno -> alumno buscando por CVU o alias. */
export async function transferMoney(
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
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { destination, amount, description, category } = parsed.data;
  const amountDec = D(amount);
  const requestId = String(formData.get("req") || "");

  // Buscar destino por alias o CVU.
  const dest = destination.trim();
  const destWallet = await prisma.wallet.findFirst({
    where: { OR: [{ alias: dest.toLowerCase() }, { cvu: dest }] },
    include: { user: true },
  });

  if (!destWallet) {
    return { ok: false, error: "No se encontró una cuenta con ese CVU o alias." };
  }
  if (destWallet.userId === me.id) {
    return { ok: false, error: "No podés transferirte dinero a vos mismo." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Bloqueo lógico: releer saldo dentro de la transacción.
      const senderWallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: me.id },
      });
      if (senderWallet.balance.lessThan(amountDec)) {
        throw new Error("SALDO_INSUFICIENTE");
      }

      await tx.wallet.update({
        where: { userId: me.id },
        data: { balance: { decrement: amountDec } },
      });
      await tx.wallet.update({
        where: { userId: destWallet.userId },
        data: { balance: { increment: amountDec } },
      });

      await tx.transaction.create({
        data: {
          type: "TRANSFER",
          amount: amountDec,
          description: description?.trim() || "Transferencia",
          category: category?.trim() || "General",
          senderId: me.id,
          receiverId: destWallet.userId,
        },
      });

      await tx.notification.create({
        data: {
          userId: destWallet.userId,
          type: "MONEY_RECEIVED",
          title: "¡Recibiste dinero!",
          body: `${me.name} te transfirió ${amount.toFixed(2)}.`,
        },
      });

      // Si la transferencia salda un pedido de cobro, marcarlo como pagado.
      if (requestId) {
        const req = await tx.paymentRequest.findUnique({
          where: { id: requestId },
        });
        if (
          req &&
          req.status === "PENDING" &&
          req.requesterId === destWallet.userId
        ) {
          await tx.paymentRequest.update({
            where: { id: requestId },
            data: { status: "PAID", paidAt: new Date(), payerId: me.id },
          });
        }
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message === "SALDO_INSUFICIENTE") {
      return { ok: false, error: "Saldo insuficiente para esta transferencia." };
    }
    return { ok: false, error: "No se pudo completar la transferencia." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/activity");
  revalidatePath("/transfer");
  return {
    ok: true,
    message: `Transferiste ${amount.toFixed(2)} a ${destWallet.user.name}.`,
  };
}

/** Pago de una factura/servicio pendiente. El dinero va al admin emisor. */
export async function payInvoice(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const invoiceId = String(formData.get("invoiceId") || "");
  if (!invoiceId) return { ok: false, error: "Factura inválida." };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { createdBy: true },
      });
      if (!invoice || invoice.studentId !== me.id) {
        throw new Error("NO_ENCONTRADA");
      }
      if (invoice.status !== "PENDING") {
        throw new Error("YA_PAGADA");
      }

      const wallet = await tx.wallet.findUniqueOrThrow({
        where: { userId: me.id },
      });
      if (wallet.balance.lessThan(invoice.amount)) {
        throw new Error("SALDO_INSUFICIENTE");
      }

      // Determinar cuenta receptora (admin emisor o primer admin).
      let adminId = invoice.createdById;
      if (!adminId) {
        const anyAdmin = await tx.user.findFirst({ where: { role: "ADMIN" } });
        adminId = anyAdmin?.id ?? null;
      }

      await tx.wallet.update({
        where: { userId: me.id },
        data: { balance: { decrement: invoice.amount } },
      });
      if (adminId) {
        await tx.wallet.update({
          where: { userId: adminId },
          data: { balance: { increment: invoice.amount } },
        });
      }

      const transaction = await tx.transaction.create({
        data: {
          type: "PAYMENT",
          amount: invoice.amount,
          description: `Pago: ${invoice.description}`,
          category: "Servicios",
          senderId: me.id,
          receiverId: adminId,
        },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          transactionId: transaction.id,
        },
      });

      if (adminId) {
        await tx.notification.create({
          data: {
            userId: adminId,
            type: "INVOICE_PAID",
            title: "Factura pagada",
            body: `${me.name} pagó "${invoice.description}".`,
          },
        });
      }
      return invoice;
    });

    revalidatePath("/bills");
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    return { ok: true, message: `Pagaste "${result.description}".` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "SALDO_INSUFICIENTE")
      return { ok: false, error: "Saldo insuficiente para pagar esta cuenta." };
    if (msg === "YA_PAGADA")
      return { ok: false, error: "Esta factura ya fue pagada." };
    if (msg === "NO_ENCONTRADA")
      return { ok: false, error: "No se encontró la factura." };
    return { ok: false, error: "No se pudo procesar el pago." };
  }
}

/** Cambiar el alias de la billetera (verificando unicidad). */
export async function updateAlias(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const me = await requireStudent();
  const parsed = aliasSchema.safeParse({ alias: formData.get("alias") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const alias = parsed.data.alias;

  const existing = await prisma.wallet.findUnique({ where: { alias } });
  if (existing && existing.userId !== me.id) {
    return { ok: false, error: "Ese alias ya está en uso. Probá con otro." };
  }

  await prisma.wallet.update({
    where: { userId: me.id },
    data: { alias },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true, message: "Alias actualizado correctamente." };
}

/** Marca todas las notificaciones del alumno como leídas. */
export async function markNotificationsRead(): Promise<void> {
  const me = await requireStudent();
  await prisma.notification.updateMany({
    where: { userId: me.id, read: false },
    data: { read: true },
  });
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}
