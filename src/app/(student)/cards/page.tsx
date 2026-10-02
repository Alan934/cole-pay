import { CreditCard as CreditCardIcon } from "lucide-react";
import { requireStudent } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  CARD_BRAND_LABELS,
  cardBalance,
  isExpired,
  nextClosingDate,
  type CardBrandName,
} from "@/lib/cards";
import { Card, CardTitle } from "@/components/ui/Card";
import { NoBankNotice } from "@/components/student/NoBankNotice";
import { CardPanel, type CardView } from "./CardPanel";
import { ApplyCardForm } from "./ApplyCardForm";
import { ApplicationsList, type ApplicationView } from "./ApplicationsList";

export const dynamic = "force-dynamic";

export default async function CardsPage() {
  const me = await requireStudent();

  const [cards, applications, banks] = await Promise.all([
    prisma.creditCard.findMany({
      where: { ownerId: me.id, status: { not: "CANCELLED" } },
      include: {
        bank: { select: { name: true, color: true, monthlyRatePct: true } },
        charges: {
          where: { statementId: null },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            kind: true,
            amount: true,
            description: true,
            category: true,
            createdAt: true,
            statementId: true,
          },
        },
        statements: {
          orderBy: { periodEnd: "desc" },
          take: 6,
          include: {
            charges: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                kind: true,
                amount: true,
                description: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: { issuedAt: "desc" },
    }),
    prisma.cardApplication.findMany({
      where: { applicantId: me.id },
      include: { bank: { select: { name: true, color: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    // Sólo los bancos donde es cliente; el principal (el primero al que se
    // adhirió) va primero y queda preseleccionado.
    prisma.bank.findMany({
      where: {
        active: true,
        memberships: { some: { studentId: me.id, endedAt: null } },
      },
      select: {
        id: true,
        name: true,
        color: true,
        defaultLimit: true,
        monthlyRatePct: true,
        closingDay: true,
        dueDays: true,
        memberships: {
          where: { studentId: me.id, endedAt: null },
          select: { adheredAt: true },
        },
      },
    }),
  ]);
  banks.sort(
    (a, b) =>
      a.memberships[0].adheredAt.getTime() -
      b.memberships[0].adheredAt.getTime(),
  );

  const views: CardView[] = cards.map((card) => {
    // La deuda se calcula con todos los resúmenes vivos, no sólo con los
    // últimos seis que mostramos en pantalla.
    const balance = cardBalance({
      creditLimit: card.creditLimit,
      charges: card.charges,
      statements: card.statements.map((s) => ({
        status: s.status,
        total: s.total,
        paid: s.paid,
      })),
    });

    return {
      id: card.id,
      visual: {
        brandLabel: CARD_BRAND_LABELS[card.brand as CardBrandName],
        number: card.number,
        last4: card.last4,
        holderName: card.holderName,
        expMonth: card.expMonth,
        expYear: card.expYear,
        cvv: card.cvv,
        bankName: card.bank.name,
        color: card.bank.color,
        status: card.status as "ACTIVE" | "BLOCKED" | "CANCELLED",
        expired: isExpired(card),
      },
      bankName: card.bank.name,
      balance,
      monthlyRatePct: Number(card.monthlyRatePct),
      dueDays: card.dueDays,
      nextClosing: nextClosingDate(
        card.lastClosedAt ?? card.issuedAt,
        card.closingDay,
      ).toISOString(),
      currentCharges: card.charges.map((c) => ({
        id: c.id,
        kind: c.kind,
        amount: Number(c.amount),
        description: c.description,
        createdAt: c.createdAt.toISOString(),
      })),
      statements: card.statements.map((s) => ({
        id: s.id,
        periodStart: s.periodStart.toISOString(),
        periodEnd: s.periodEnd.toISOString(),
        dueDate: s.dueDate.toISOString(),
        status: s.status,
        previousBalance: Number(s.previousBalance),
        chargesTotal: Number(s.chargesTotal),
        interest: Number(s.interest),
        total: Number(s.total),
        paid: Number(s.paid),
        charges: s.charges.map((c) => ({
          id: c.id,
          kind: c.kind,
          amount: Number(c.amount),
          description: c.description,
          createdAt: c.createdAt.toISOString(),
        })),
      })),
    };
  });

  const appViews: ApplicationView[] = applications.map((a) => ({
    id: a.id,
    bankName: a.bank.name,
    color: a.bank.color,
    status: a.status,
    requestedLimit: Number(a.requestedLimit),
    purpose: a.purpose,
    reviewNote: a.reviewNote,
    createdAt: a.createdAt.toISOString(),
  }));

  // Bancos a los que todavía les puede pedir una tarjeta.
  const usedBanks = new Set([
    ...cards.map((c) => c.bank.name),
    ...applications.filter((a) => a.status === "PENDING").map((a) => a.bank.name),
  ]);
  const bankOptions = banks
    .filter((b) => !usedBanks.has(b.name))
    .map((b) => ({
      id: b.id,
      name: b.name,
      color: b.color,
      defaultLimit: Number(b.defaultLimit),
      monthlyRatePct: Number(b.monthlyRatePct),
      closingDay: b.closingDay,
      dueDays: b.dueDays,
    }));

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Mis tarjetas</h1>
        <p className="text-sm text-ink/50">
          Comprá ahora con plata del banco y pagá el resumen antes del
          vencimiento.
        </p>
      </div>

      {banks.length === 0 && <NoBankNotice what="pedir una tarjeta" />}

      {banks.length > 0 && views.length === 0 && appViews.length === 0 && (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet/15 text-violet">
            <CreditCardIcon className="h-7 w-7" />
          </div>
          <div>
            <CardTitle className="text-base text-ink">
              Todavía no tenés tarjeta
            </CardTitle>
            <p className="mt-1 text-sm text-ink/50">
              Pedile una a un banco. Si te la aprueban, vas a poder comprar a
              crédito y pagar después.
            </p>
          </div>
        </Card>
      )}

      {views.map((view) => (
        <CardPanel key={view.id} card={view} />
      ))}

      <ApplicationsList applications={appViews} />

      {bankOptions.length > 0 && <ApplyCardForm banks={bankOptions} />}
    </div>
  );
}
