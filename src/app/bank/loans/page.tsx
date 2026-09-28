import { HandCoins } from "lucide-react";
import { requireBankStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { loanReviewInclude, toLoanReview } from "@/lib/card-views";
import { LoanReview } from "@/components/loans/LoanReview";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { loanProgress } from "@/lib/loans";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RESOLVED: Record<
  string,
  { label: string; tone: "success" | "danger" | "neutral" | "violet" }
> = {
  ACTIVE: { label: "Pagando", tone: "violet" },
  PAID: { label: "Pagado", tone: "success" },
  REJECTED: { label: "Rechazado", tone: "danger" },
  CANCELLED: { label: "Dado de baja", tone: "neutral" },
};

export default async function BankLoansPage() {
  const me = await requireBankStaff();
  const bank = me.bank;
  if (!bank) return null;

  const [pending, rest] = await Promise.all([
    prisma.loan.findMany({
      where: { bankId: bank.id, status: "PENDING" },
      include: loanReviewInclude,
      orderBy: { createdAt: "asc" },
    }),
    prisma.loan.findMany({
      where: { bankId: bank.id, status: { not: "PENDING" } },
      include: {
        borrower: { select: { name: true, group: { select: { name: true } } } },
      },
      orderBy: [{ status: "asc" }, { reviewedAt: "desc" }],
      take: 30,
    }),
  ]);

  const lent = rest
    .filter((l) => l.status === "ACTIVE")
    .reduce(
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
        <h1 className="text-2xl font-bold">Préstamos</h1>
        <p className="text-sm text-ink/50">
          Evaluá quién pide plata y decidí cuánto darle, a qué tasa y en cuántas
          cuotas. Al aprobar, el capital sale de la caja del banco.
        </p>
      </div>

      {lent > 0 && (
        <p className="text-sm text-ink/55">
          Tenés {formatMoney(lent)} prestados esperando que te los devuelvan.
        </p>
      )}

      {pending.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-raised2 text-ink/50">
            <HandCoins className="h-7 w-7" />
          </div>
          <div>
            <CardTitle className="text-base text-ink">
              No hay pedidos esperando
            </CardTitle>
            <p className="mt-1 text-sm text-ink/50">
              Cuando un alumno le pida un préstamo a {bank.name}, va a aparecer
              acá.
            </p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {pending.map((l) => (
            <LoanReview key={l.id} loan={toLoanReview(l)} />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <Card>
          <CardTitle className="mb-3">Préstamos ya resueltos</CardTitle>
          <div className="divide-y divide-raised">
            {rest.map((l) => {
              const badge = RESOLVED[l.status] ?? {
                label: l.status,
                tone: "neutral" as const,
              };
              const progress = loanProgress({
                totalToRepay:
                  l.totalToRepay === null ? null : Number(l.totalToRepay),
                paidAmount: Number(l.paidAmount),
                installmentAmount:
                  l.installmentAmount === null
                    ? null
                    : Number(l.installmentAmount),
                installments: l.installments,
              });
              return (
                <div key={l.id} className="py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {l.borrower.name}
                        {l.borrower.group && (
                          <span className="ml-2 text-xs font-normal text-ink/40">
                            {l.borrower.group.name}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-ink/40">
                        {l.principal
                          ? `${formatMoney(Number(l.principal))} en ${l.installments} cuotas`
                          : `Pidió ${formatMoney(Number(l.requestedAmount))}`}
                        {" · "}
                        {l.reviewedAt ? formatDate(l.reviewedAt) : "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {l.status === "ACTIVE" && (
                        <span className="text-xs text-ink/50">
                          {progress.paidInstallments}/{progress.installments}{" "}
                          cuotas · debe {formatMoney(progress.remaining)}
                        </span>
                      )}
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </div>
                  </div>
                  {l.reviewNote && (
                    <p className="mt-1 text-xs text-ink/50">{l.reviewNote}</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
