import { redirect } from "next/navigation";
import { Landmark } from "lucide-react";
import { requireBankStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { BackButton } from "@/components/BackButton";
import { BankNav } from "@/components/bank/BankNav";
import { NavProgressProvider } from "@/components/NavProgress";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { IdleLogout } from "@/components/IdleLogout";

export default async function BankLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireBankStaff();

  // La profe y el admin administran los bancos desde su propio panel; acá
  // adentro sólo tiene sentido estar parado en un banco concreto.
  if (!me.bank && me.role !== "BANK_EMPLOYEE") redirect("/admin/banks");

  const pending = me.bank
    ? await prisma.cardApplication.count({
        where: { bankId: me.bank.id, status: "PENDING" },
      })
    : 0;
  const pendingLoans = me.bank
    ? await prisma.loan.count({
        where: { bankId: me.bank.id, status: "PENDING" },
      })
    : 0;
  // Los cheques en circulación no son de ningún banco: se cuentan los que ya
  // se pueden presentar y cuyo beneficiario es cliente de este mostrador.
  const pendingCheques = me.bank
    ? await prisma.cheque.count({
        where: {
          status: "ISSUED",
          payableAt: { lte: new Date() },
          payee: {
            memberships: { some: { bankId: me.bank.id, endedAt: null } },
          },
        },
      })
    : 0;

  return (
    <NavProgressProvider>
      <IdleLogout />
      <div className="min-h-dvh">
        <header className="sticky top-0 z-30 border-b border-raised/60 bg-canvas/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <BackButton home="/bank" />
                <Logo size="sm" />
                {me.bank ? (
                  <Badge tone="accent">{me.bank.name}</Badge>
                ) : (
                  <Badge tone="neutral">Sin banco</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden text-sm text-ink/50 sm:inline">
                  {me.name}
                </span>
                <ThemeToggle />
                <LogoutButton />
              </div>
            </div>
            {me.bank && (
              <BankNav
                pending={pending}
                pendingLoans={pendingLoans}
                pendingCheques={pendingCheques}
              />
            )}
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          {me.bank ? (
            children
          ) : (
            <Card className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-raised2 text-ink/50">
                <Landmark className="h-7 w-7" />
              </div>
              <div>
                <CardTitle className="text-base text-ink">
                  Todavía no estás en ningún banco
                </CardTitle>
                <p className="mt-1 text-sm text-ink/50">
                  Pedile a la profe que te asigne a uno para empezar a atender
                  solicitudes.
                </p>
              </div>
            </Card>
          )}
        </main>
      </div>
    </NavProgressProvider>
  );
}
