import { Prisma } from "@prisma/client";
import { taxIdText } from "@/lib/identity";
import {
  CARD_BRAND_LABELS,
  cardBalance,
  isExpired,
  type CardBrandName,
} from "@/lib/cards";
import type { BankCardView } from "@/components/cards/BankCardRow";
import type { ApplicationReviewData } from "@/components/cards/ApplicationReview";
import type { LoanReviewData } from "@/components/loans/LoanReview";

/**
 * Traducciones de la base a las vistas del mostrador. Están acá para que la
 * pantalla del banco y la de supervisión de la profe muestren exactamente los
 * mismos datos.
 */

/* ----------------------------- Solicitudes -------------------------------- */

/** Include de Prisma que deja la solicitud lista para `toApplicationReview`. */
export const applicationReviewInclude = {
  bank: { select: { name: true, defaultLimit: true } },
  applicant: {
    select: {
      name: true,
      dni: true,
      cuit: true,
      group: { select: { name: true } },
      wallet: { select: { balance: true } },
    },
  },
} satisfies Prisma.CardApplicationInclude;

type ApplicationRow = Prisma.CardApplicationGetPayload<{
  include: typeof applicationReviewInclude;
}>;

/**
 * Junto al pedido se muestra todo lo que sirve para decidir: quién es, de qué
 * curso, cuánta plata mueve y cuánto suele prestar el banco.
 */
export function toApplicationReview(app: ApplicationRow): ApplicationReviewData {
  return {
    id: app.id,
    bankName: app.bank.name,
    applicantName: app.applicant.name,
    applicantTaxId: taxIdText(app.applicant) || null,
    applicantGroup: app.applicant.group?.name ?? null,
    applicantBalance: Number(app.applicant.wallet?.balance ?? 0),
    requestedLimit: Number(app.requestedLimit),
    monthlyIncome: app.monthlyIncome === null ? null : Number(app.monthlyIncome),
    purpose: app.purpose,
    createdAt: app.createdAt.toISOString(),
    suggestedLimit: Number(app.bank.defaultLimit),
  };
}

/* ------------------------------- Tarjetas --------------------------------- */

/** Include de Prisma que deja la tarjeta lista para `toBankCardView`. */
export const bankCardInclude = {
  bank: { select: { name: true } },
  owner: { select: { name: true, group: { select: { name: true } } } },
  charges: {
    where: { statementId: null },
    select: { amount: true, statementId: true },
  },
  statements: {
    where: { status: { in: ["CLOSED", "OVERDUE"] } },
    select: { status: true, total: true, paid: true },
  },
} satisfies Prisma.CreditCardInclude;

type CardRow = Prisma.CreditCardGetPayload<{ include: typeof bankCardInclude }>;

/** Pasa una tarjeta de la base a la ficha que ve el banco. */
export function toBankCardView(card: CardRow): BankCardView {
  const balance = cardBalance(card);
  return {
    id: card.id,
    bankId: card.bankId,
    bankName: card.bank.name,
    ownerName: card.owner.name,
    ownerGroup: card.owner.group?.name ?? null,
    brandLabel: CARD_BRAND_LABELS[card.brand as CardBrandName],
    last4: card.last4,
    holderName: card.holderName,
    expMonth: card.expMonth,
    expYear: card.expYear,
    status: card.status,
    expired: isExpired(card),
    creditLimit: balance.limit,
    debt: balance.debt,
    currentPeriod: balance.currentPeriod,
    billed: balance.billed,
    overdueCount: card.statements.filter((s) => s.status === "OVERDUE").length,
    lastClosedAt: card.lastClosedAt?.toISOString() ?? null,
  };
}

/* ------------------------------- Préstamos -------------------------------- */

/** Include de Prisma que deja el pedido listo para `toLoanReview`. */
export const loanReviewInclude = {
  bank: {
    select: {
      name: true,
      loanRatePct: true,
      maxLoanAmount: true,
      account: { select: { wallet: { select: { balance: true } } } },
    },
  },
  borrower: {
    select: {
      name: true,
      dni: true,
      cuit: true,
      group: { select: { name: true } },
      wallet: { select: { balance: true } },
      // Para saber cuánto ya le debe al sistema por la tarjeta.
      creditCards: {
        where: { status: { in: ["ACTIVE", "BLOCKED"] } },
        select: {
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
      },
    },
  },
} satisfies Prisma.LoanInclude;

type LoanRow = Prisma.LoanGetPayload<{ include: typeof loanReviewInclude }>;

/**
 * Pasa un pedido de préstamo a la vista del mostrador. Junto al pedido se le
 * muestra al banco todo lo que necesita para decidir: cuánto gana el cliente,
 * cuánto tiene, cuánto ya debe y cuánta caja hay para prestar.
 */
export function toLoanReview(loan: LoanRow): LoanReviewData {
  const cardDebt = loan.borrower.creditCards.reduce(
    (acc, card) => acc + cardBalance(card).debt,
    0,
  );

  return {
    id: loan.id,
    bankName: loan.bank.name,
    borrowerName: loan.borrower.name,
    borrowerTaxId: taxIdText(loan.borrower) || null,
    borrowerGroup: loan.borrower.group?.name ?? null,
    borrowerBalance: Number(loan.borrower.wallet?.balance ?? 0),
    cardDebt,
    requestedAmount: Number(loan.requestedAmount),
    requestedInstallments: loan.requestedInstallments,
    monthlyIncome:
      loan.monthlyIncome === null ? null : Number(loan.monthlyIncome),
    purpose: loan.purpose,
    createdAt: loan.createdAt.toISOString(),
    bankRatePct: Number(loan.bank.loanRatePct),
    bankMaxLoan: Number(loan.bank.maxLoanAmount),
    bankBalance: Number(loan.bank.account.wallet?.balance ?? 0),
  };
}
