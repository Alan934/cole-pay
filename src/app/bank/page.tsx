import Link from "next/link";
import {
  CreditCard as CreditCardIcon,
  HandCoins,
  Inbox,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { requireBankStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cardBalance } from "@/lib/cards";
import { loanProgress } from "@/lib/loans";
import { formatDate, formatMoney } from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ClosePeriodForm } from "@/components/cards/ClosePeriodForm";

export const dynamic = "force-dynamic";

export default async function BankDeskPage() {
  const me = await requireBankStaff();
  const bank = me.bank;
  if (!bank) return null;

  const [pendingApps, cards, recentTx, pendingLoans, activeLoans] = await Promise.all([
    prisma.cardApplication.findMany({
      where: { bankId: bank.id, status: "PENDING" },
      include: { applicant: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    prisma.creditCard.findMany({
      where: { bankId: bank.id, status: { in: ["ACTIVE", "BLOCKED"] } },
      select: {
        id: true,
        creditLimit: true,
        charges: {
          where: { statementId: null },
          select: { amount: true, statementId: true },
        },
        statements: {
          where: { status: { in: ["CLOSED", "OVERDUE"] } },
          select: { status: true, total: true, paid: true },
        },
      },
    }),
    prisma.transaction.findMany({
      where: {
        OR: [{ senderId: bank.accountId }, { receiverId: bank.accountId }],
      },
      include: {
        sender: { select: { name: true } },
        receiver: { select: { name: true } },
      },
      orderBy: { timestamp: "desc" },
      take: 8,
    }),
    prisma.loan.findMany({
      where: { bankId: bank.id, status: "PENDING" },
      include: { borrower: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    prisma.loan.findMany({
      where: { bankId: bank.id, status: "ACTIVE" },
      select: {
        totalToRepay: true,
        paidAmount: true,
        installmentAmount: true,
        installments: true,
      },
    }),
  ]);

  const balance = Number(bank.account.wallet?.balance ?? 0);
  const lentInCards = cards.reduce((acc, c) => acc + cardBalance(c).debt, 0);
  const lentInLoans = activeLoans.reduce(
    (acc, l) =>
      acc +
      loanProgress({
        totalToRepay: l.totalToRepay === null ? null : Number(l.totalToRepay),
        paidAmount: Number(l.paidAmount),
        installmentAmount:
          l.installmentAmount === null ? null : Number(l.installmentAmount),
        installments: l.installments,
      }).remaining,
    0,
  );
  const lent = lentInCards + lentInLoans;
  const overdue = await prisma.cardStatement.count({
    where: { card: { bankId: bank.id }, status: "OVERDUE" },
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">{bank.name}</h1>
        <p className="text-sm text-ink/50">
          Atendé las solicitudes, emití las tarjetas y cobrá los resúmenes.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          icon={Wallet}
          label="Caja del banco"
          value={formatMoney(balance)}
          tone="text-accent"
        />
        <Stat
          icon={TrendingDown}
          label="Prestado a clientes"
          value={formatMoney(lent)}
          tone="text-violet"
        />
        <Stat
          icon={HandCoins}
          label="Pedidos de préstamo"
          value={pendingLoans.length.toString()}
          tone={pendingLoans.length > 0 ? "text-warning" : "text-ink"}
        />
        <Stat
          icon={CreditCardIcon}
          label="Tarjetas vigentes"
          value={cards.length.toString()}
          tone="text-ink"
        />
        <Stat
          icon={Inbox}
          label="Resúmenes vencidos"
          value={overdue.toString()}
          tone={overdue > 0 ? "text-danger" : "text-ink"}
        />
      </div>

      {balance <= 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardTitle className="text-ink/80">La caja está en cero</CardTitle>
          <p className="mt-1 text-sm text-ink/55">
            Sin fondos no podés autorizar consumos: cuando un cliente pague con
            la tarjeta, la compra se va a rechazar. Pedile a la profe que
            capitalice el banco.
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <CardTitle className="text-ink/80">Solicitudes esperando</CardTitle>
            <Link
              href="/bank/applications"
              className="text-sm font-medium text-accent hover:underline"
            >
              Ver todas
            </Link>
          </div>
          {pendingApps.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink/40">
              No hay solicitudes pendientes.
            </p>
          ) : (
            <ul className="divide-y divide-raised">
              {pendingApps.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.applicant.name}</p>
                    <p className="text-xs text-ink/40">
                      {formatDate(a.createdAt)}
                    </p>
                  </div>
                  <Badge tone="warning">
                    {formatMoney(Number(a.requestedLimit))}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <CardTitle className="text-ink/80">
              Pedidos de préstamo
            </CardTitle>
            <Link
              href="/bank/loans"
              className="text-sm font-medium text-accent hover:underline"
            >
              Ver todos
            </Link>
          </div>
          {pendingLoans.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink/40">
              No hay pedidos de préstamo pendientes.
            </p>
          ) : (
            <ul className="divide-y divide-raised">
              {pendingLoans.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.borrower.name}</p>
                    <p className="text-xs text-ink/40">
                      {l.requestedInstallments} cuotas ·{" "}
                      {formatDate(l.createdAt)}
                    </p>
                  </div>
                  <Badge tone="warning">
                    {formatMoney(Number(l.requestedAmount))}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle className="mb-1 text-ink/80">Cierre de período</CardTitle>
          <p className="mb-4 text-sm text-ink/50">
            Emití el resumen de todas las tarjetas del banco sin esperar a la
            fecha de cierre. A cada cliente le llega su resumen con la fecha de
            vencimiento.
          </p>
          <ClosePeriodForm bankId={bank.id} />
        </Card>
      </div>

      <Card>
        <CardTitle className="mb-3">Movimientos de la cuenta</CardTitle>
        {recentTx.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/40">
            Todavía no hubo movimientos.
          </p>
        ) : (
          <div className="divide-y divide-raised">
            {recentTx.map((tx) => {
              const incoming = tx.receiverId === bank.accountId;
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-ink/85">{tx.description}</p>
                    <p className="truncate text-xs text-ink/40">
                      {incoming
                        ? `de ${tx.sender?.name ?? "Banco Central"}`
                        : `a ${tx.receiver?.name ?? "Sistema"}`}{" "}
                      · {formatDate(tx.timestamp)}
                    </p>
                  </div>
                  <span
                    className={
                      incoming
                        ? "shrink-0 font-semibold text-accent"
                        : "shrink-0 font-semibold text-ink/70"
                    }
                  >
                    {incoming ? "+" : "−"}
                    {formatMoney(Number(tx.amount))}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${tone}`} />
        <span className="text-xs text-ink/50">{label}</span>
      </div>
      <p className={`text-xl font-bold ${tone}`}>{value}</p>
    </Card>
  );
}
