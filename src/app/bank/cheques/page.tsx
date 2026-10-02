import { Prisma } from "@prisma/client";
import { requireBankStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { daysUntilPayable } from "@/lib/cheques";
import { ChequeDesk, type DeskChequeView } from "@/components/bank/ChequeDesk";

export const dynamic = "force-dynamic";

/**
 * Junto al cheque se le muestra al cajero lo único que necesita para decidir:
 * si el que lo firmó tiene la plata, y si ya le rebotaron otros.
 */
const deskInclude = {
  drawer: {
    select: {
      name: true,
      group: { select: { name: true } },
      wallet: { select: { balance: true } },
      _count: { select: { chequesDrawn: { where: { status: "BOUNCED" } } } },
    },
  },
  payee: { select: { name: true } },
  bank: { select: { name: true } },
} satisfies Prisma.ChequeInclude;

type Row = Prisma.ChequeGetPayload<{ include: typeof deskInclude }>;

function toView(c: Row): DeskChequeView {
  return {
    id: c.id,
    number: c.number,
    amount: Number(c.amount),
    concept: c.concept,
    status: c.status,
    payableAt: c.payableAt.toISOString(),
    daysToPayable: daysUntilPayable(c.payableAt),
    drawerName: c.drawer.name,
    drawerGroup: c.drawer.group?.name ?? null,
    drawerBalance: Number(c.drawer.wallet?.balance ?? 0),
    drawerBounced: c.drawer._count.chequesDrawn,
    payeeName: c.payee.name,
    bankName: c.bank?.name ?? null,
    fee: c.fee === null ? null : Number(c.fee),
    bounceReason: c.bounceReason,
  };
}

export default async function BankChequesPage() {
  const me = await requireBankStaff();
  const bank = me.bank;
  if (!bank) return null;

  // Los cheques en circulación no son de ningún banco todavía, pero sólo se
  // presentan en la ventanilla donde el beneficiario es cliente. Los ya
  // procesados quedan atados al banco que atendió.
  const [pending, history, students, drawers] = await Promise.all([
    prisma.cheque.findMany({
      where: {
        status: "ISSUED",
        payee: { memberships: { some: { bankId: bank.id, endedAt: null } } },
      },
      include: deskInclude,
      orderBy: [{ payableAt: "asc" }, { issuedAt: "asc" }],
      take: 60,
    }),
    prisma.cheque.findMany({
      where: { bankId: bank.id, status: { in: ["PAID", "BOUNCED"] } },
      include: deskInclude,
      orderBy: { issuedAt: "desc" },
      take: 20,
    }),
    prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { id: true, name: true, group: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    // Para librar un cheque hay que ser cliente de algún banco.
    prisma.user.findMany({
      where: {
        role: "STUDENT",
        memberships: { some: { endedAt: null } },
      },
      select: { id: true, name: true, group: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Cheques</h1>
        <p className="text-sm text-ink/50">
          Verificá el papel contra lo que dice el sistema y hacelo efectivo. Si
          el librador no tiene fondos, el cheque rebota y queda registrado.
          Sólo ves los cheques de tus clientes: el que cobra tiene que estar
          adherido a tu banco.
        </p>
      </div>

      <ChequeDesk
        pending={pending.map(toView)}
        history={history.map(toView)}
        students={students.map((s) => ({
          id: s.id,
          name: s.name,
          group: s.group?.name ?? null,
        }))}
        drawers={drawers.map((s) => ({
          id: s.id,
          name: s.name,
          group: s.group?.name ?? null,
        }))}
        feePct={Number(bank.chequeFeePct)}
        bankName={bank.name}
      />
    </div>
  );
}
