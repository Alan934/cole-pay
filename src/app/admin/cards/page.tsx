import {
  AlertTriangle,
  CreditCard as CreditCardIcon,
  HandCoins,
  Inbox,
} from "lucide-react";
import { requireBankAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  applicationReviewInclude,
  bankCardInclude,
  loanReviewInclude,
  toApplicationReview,
  toBankCardView,
  toLoanReview,
} from "@/lib/card-views";
import { loanProgress } from "@/lib/loans";
import { ApplicationReview } from "@/components/cards/ApplicationReview";
import { LoanReview } from "@/components/loans/LoanReview";
import { BankCardRow } from "@/components/cards/BankCardRow";
import { Card, CardTitle } from "@/components/ui/Card";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CardsSupervisionPage() {
  await requireBankAdminSession();

  const [pending, cards, overdue, pendingLoans, activeLoans] = await Promise.all([
    prisma.cardApplication.findMany({
      where: { status: "PENDING" },
      include: applicationReviewInclude,
      orderBy: { createdAt: "asc" },
    }),
    prisma.creditCard.findMany({
      where: { status: { not: "CANCELLED" } },
      include: bankCardInclude,
      orderBy: { issuedAt: "desc" },
    }),
    prisma.cardStatement.findMany({
      where: { status: "OVERDUE" },
      include: {
        card: {
          select: {
            last4: true,
            owner: { select: { name: true } },
            bank: { select: { name: true } },
          },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    prisma.loan.findMany({
      where: { status: "PENDING" },
      include: loanReviewInclude,
      orderBy: { createdAt: "asc" },
    }),
    prisma.loan.findMany({
      where: { status: "ACTIVE" },
      select: {
        totalToRepay: true,
        paidAmount: true,
        installmentAmount: true,
        installments: true,
      },
    }),
  ]);

  const views = cards.map(toBankCardView);
  const lent = views.reduce((acc, c) => acc + c.debt, 0);
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

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Tarjetas y crédito</h1>
        <p className="text-sm text-ink/50">
          Todo el crédito del sistema en un lugar. Si un banco no responde una
          solicitud, podés resolverla vos.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={Inbox}
          label="Solicitudes pendientes"
          value={pending.length.toString()}
          tone={pending.length > 0 ? "text-warning" : "text-ink"}
        />
        <Stat
          icon={CreditCardIcon}
          label="Tarjetas vigentes"
          value={views.length.toString()}
          tone="text-ink"
        />
        <Stat
          icon={CreditCardIcon}
          label="Crédito de tarjetas"
          value={formatMoney(lent)}
          tone="text-violet"
        />
        <Stat
          icon={AlertTriangle}
          label="Resúmenes en mora"
          value={overdue.length.toString()}
          tone={overdue.length > 0 ? "text-danger" : "text-ink"}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-2">
        <Stat
          icon={HandCoins}
          label="Pedidos de préstamo"
          value={pendingLoans.length.toString()}
          tone={pendingLoans.length > 0 ? "text-warning" : "text-ink"}
        />
        <Stat
          icon={HandCoins}
          label="Prestado en cuotas"
          value={formatMoney(lentInLoans)}
          tone="text-violet"
        />
      </div>

      <section className="flex flex-col gap-3">
        <CardTitle>Solicitudes de tarjeta esperando respuesta</CardTitle>
        {pending.length === 0 ? (
          <Card>
            <p className="py-6 text-center text-sm text-ink/40">
              Ningún banco tiene solicitudes sin responder.
            </p>
          </Card>
        ) : (
          pending.map((a) => (
            <ApplicationReview
              key={a.id}
              application={toApplicationReview(a)}
              showBank
            />
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <CardTitle>Pedidos de préstamo esperando respuesta</CardTitle>
        {pendingLoans.length === 0 ? (
          <Card>
            <p className="py-6 text-center text-sm text-ink/40">
              Ningún banco tiene pedidos de préstamo sin responder.
            </p>
          </Card>
        ) : (
          pendingLoans.map((l) => (
            <LoanReview key={l.id} loan={toLoanReview(l)} showBank />
          ))
        )}
      </section>

      {overdue.length > 0 && (
        <Card>
          <CardTitle className="mb-3">Clientes en mora</CardTitle>
          <div className="divide-y divide-raised">
            {overdue.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.card.owner.name}</p>
                  <p className="truncate text-xs text-ink/40">
                    {s.card.bank.name} ••••{s.card.last4} · venció{" "}
                    {formatDate(s.dueDate)}
                  </p>
                </div>
                <span className="shrink-0 font-semibold text-danger">
                  {formatMoney(Number(s.total) - Number(s.paid))}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {views.length > 0 && (
        <section className="flex flex-col gap-3">
          <CardTitle>Tarjetas emitidas</CardTitle>
          {views.map((card) => (
            <BankCardRow key={card.id} card={card} showBank />
          ))}
        </section>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Inbox;
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
      <p className={`truncate text-xl font-bold ${tone}`}>{value}</p>
    </Card>
  );
}
