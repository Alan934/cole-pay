import { requireStudent } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { daysUntilPayable, isDeferred } from "@/lib/cheques";
import { ChequesManager, type ChequeView } from "./ChequesManager";

export const dynamic = "force-dynamic";

const chequeInclude = {
  drawer: { select: { name: true } },
  payee: { select: { name: true } },
  bank: { select: { name: true } },
};

type ChequeRow = {
  id: string;
  number: string;
  amount: unknown;
  concept: string | null;
  status: string;
  issuedAt: Date;
  payableAt: Date;
  fee: unknown;
  bounceReason: string | null;
  drawer: { name: string };
  payee: { name: string };
  bank: { name: string } | null;
};

/** Pasa un cheque de la base a la ficha que ve el alumno. */
function toView(c: ChequeRow, role: "drawer" | "payee"): ChequeView {
  return {
    id: c.id,
    number: c.number,
    amount: Number(c.amount),
    concept: c.concept,
    status: c.status,
    issuedAt: c.issuedAt.toISOString(),
    payableAt: c.payableAt.toISOString(),
    deferred: isDeferred(c),
    daysToPayable: daysUntilPayable(c.payableAt),
    counterpartyName: role === "drawer" ? c.payee.name : c.drawer.name,
    bankName: c.bank?.name ?? null,
    fee: c.fee === null ? null : Number(c.fee),
    bounceReason: c.bounceReason,
  };
}

export default async function ChequesPage() {
  const me = await requireStudent();

  const [drawn, received, payees] = await Promise.all([
    prisma.cheque.findMany({
      where: { drawerId: me.id },
      include: chequeInclude,
      orderBy: { issuedAt: "desc" },
      take: 40,
    }),
    prisma.cheque.findMany({
      where: { payeeId: me.id },
      include: chequeInclude,
      orderBy: { issuedAt: "desc" },
      take: 40,
    }),
    prisma.user.findMany({
      where: { role: "STUDENT", id: { not: me.id } },
      select: { id: true, name: true, group: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Cheques 🧾</h1>
        <p className="text-sm text-ink/50">
          Una promesa de pago firmada. El que lo recibe lo cobra en el banco, y
          ahí se ve si había plata de verdad.
        </p>
      </div>

      <ChequesManager
        drawn={drawn.map((c) => toView(c, "drawer"))}
        received={received.map((c) => toView(c, "payee"))}
        payees={payees.map((p) => ({
          id: p.id,
          name: p.name,
          group: p.group?.name ?? null,
        }))}
        balance={Number(me.wallet?.balance ?? 0)}
      />
    </div>
  );
}
