import { HandCoins } from "lucide-react";
import { requireStudent } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { LoanPanel, type LoanView } from "./LoanPanel";
import { LoanRequestForm, type LoanBankOption } from "./LoanRequestForm";

export const dynamic = "force-dynamic";

export default async function LoansPage() {
  const me = await requireStudent();

  const [loans, banks] = await Promise.all([
    prisma.loan.findMany({
      where: { borrowerId: me.id },
      include: { bank: { select: { name: true, color: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.bank.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        loanRatePct: true,
        maxLoanAmount: true,
      },
    }),
  ]);

  const views: LoanView[] = loans.map((l) => ({
    id: l.id,
    bankName: l.bank.name,
    color: l.bank.color,
    status: l.status,
    requestedAmount: Number(l.requestedAmount),
    requestedInstallments: l.requestedInstallments,
    purpose: l.purpose,
    reviewNote: l.reviewNote,
    createdAt: l.createdAt.toISOString(),
    principal: l.principal === null ? null : Number(l.principal),
    monthlyRatePct:
      l.monthlyRatePct === null ? null : Number(l.monthlyRatePct),
    installments: l.installments,
    installmentAmount:
      l.installmentAmount === null ? null : Number(l.installmentAmount),
    totalToRepay: l.totalToRepay === null ? null : Number(l.totalToRepay),
    paidAmount: Number(l.paidAmount),
    disbursedAt: l.disbursedAt?.toISOString() ?? null,
  }));

  // No se le puede pedir dos veces al mismo banco mientras haya uno abierto.
  const busyBanks = new Set(
    loans
      .filter((l) => l.status === "PENDING" || l.status === "ACTIVE")
      .map((l) => l.bank.name),
  );
  const bankOptions: LoanBankOption[] = banks
    .filter((b) => !busyBanks.has(b.name))
    .map((b) => ({
      id: b.id,
      name: b.name,
      color: b.color,
      loanRatePct: Number(b.loanRatePct),
      maxLoanAmount: Number(b.maxLoanAmount),
    }));

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Préstamos</h1>
        <p className="text-sm text-ink/50">
          Plata del banco hoy, para devolver en cuotas. Ojo con los intereses.
        </p>
      </div>

      {views.length === 0 && (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-violet/15 text-violet">
            <HandCoins className="h-7 w-7" />
          </div>
          <div>
            <CardTitle className="text-base text-ink">
              Todavía no pediste ningún préstamo
            </CardTitle>
            <p className="mt-1 text-sm text-ink/50">
              Sirve cuando necesitás plata ahora para tu emprendimiento y la
              vas a poder devolver con lo que vendas.
            </p>
          </div>
        </Card>
      )}

      {views.map((loan) => (
        <LoanPanel key={loan.id} loan={loan} />
      ))}

      {bankOptions.length > 0 ? (
        <LoanRequestForm banks={bankOptions} />
      ) : (
        banks.length > 0 && (
          <Card>
            <p className="text-sm text-ink/55">
              Ya tenés un pedido o un préstamo abierto en cada banco. Terminá de
              pagar para poder pedir otro.
            </p>
          </Card>
        )
      )}
    </div>
  );
}
