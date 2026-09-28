import { Landmark, UserPlus, Users } from "lucide-react";
import { NavLink } from "@/components/NavProgress";
import { requireBankAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cardBalance } from "@/lib/cards";
import { formatMoney } from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BankForm } from "./BankForm";
import { CreateBankUserForm } from "./CreateBankUserForm";

export const dynamic = "force-dynamic";

export default async function BanksPage() {
  await requireBankAdminSession();

  const [banks, unassigned] = await Promise.all([
    prisma.bank.findMany({
      orderBy: { name: "asc" },
      include: {
        account: { select: { wallet: { select: { balance: true } } } },
        _count: { select: { employees: true } },
        cards: {
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
        applications: { where: { status: "PENDING" }, select: { id: true } },
      },
    }),
    prisma.user.count({ where: { role: "BANK_EMPLOYEE", bankId: null } }),
  ]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Bancos</h1>
        <p className="text-sm text-ink/50">
          Los bancos los atienden los alumnos de quinto. Acá los creás, les
          ponés la política de crédito y les asignás el equipo.
        </p>
      </div>

      {unassigned > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <p className="text-sm text-ink/70">
            Hay {unassigned}{" "}
            {unassigned === 1
              ? "alumno de quinto sin banco"
              : "alumnos de quinto sin banco"}
            . Entrá a un banco y asignalos para que puedan trabajar.
          </p>
        </Card>
      )}

      {banks.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-raised2 text-ink/50">
            <Landmark className="h-7 w-7" />
          </div>
          <div>
            <CardTitle className="text-base text-ink">
              Todavía no hay bancos
            </CardTitle>
            <p className="mt-1 text-sm text-ink/50">
              Creá el primero con el formulario de abajo.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {banks.map((bank) => {
            const lent = bank.cards.reduce(
              (acc, c) => acc + cardBalance(c).debt,
              0,
            );
            return (
              <NavLink key={bank.id} href={`/admin/banks/${bank.id}`}>
                <Card className="transition-colors hover:border-accent/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="h-11 w-11 shrink-0 rounded-xl"
                        style={{ backgroundColor: bank.color }}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{bank.name}</p>
                        <p className="text-xs text-ink/45">
                          {bank._count.employees}{" "}
                          {bank._count.employees === 1
                            ? "empleado"
                            : "empleados"}{" "}
                          · {bank.cards.length}{" "}
                          {bank.cards.length === 1 ? "tarjeta" : "tarjetas"}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {bank.active ? (
                        <Badge tone="success">Abierto</Badge>
                      ) : (
                        <Badge tone="neutral">Cerrado</Badge>
                      )}
                      {bank.applications.length > 0 && (
                        <Badge tone="warning">
                          {bank.applications.length} pendientes
                        </Badge>
                      )}
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <Fact
                      label="Caja"
                      value={formatMoney(
                        Number(bank.account.wallet?.balance ?? 0),
                      )}
                    />
                    <Fact label="Prestado" value={formatMoney(lent)} />
                    <Fact
                      label="Interés"
                      value={`${bank.monthlyRatePct}% / mes`}
                    />
                  </dl>
                </Card>
              </NavLink>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Landmark className="h-5 w-5 text-accent" />
            <CardTitle className="text-ink/80">Crear un banco</CardTitle>
          </div>
          <p className="mb-4 text-sm text-ink/50">
            Cada banco arranca con caja en cero: acordate de capitalizarlo antes
            de que empiecen a usar las tarjetas.
          </p>
          <BankForm />
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-violet" />
            <CardTitle className="text-ink/80">
              Crear un usuario de quinto
            </CardTitle>
          </div>
          <p className="mb-4 text-sm text-ink/50">
            Los empleados del banco no tienen billetera propia: entran
            directamente al mostrador de su banco.
          </p>
          <CreateBankUserForm
            banks={banks.map((b) => ({ id: b.id, name: b.name }))}
          />
        </Card>
      </div>

      <p className="flex items-center justify-center gap-2 text-xs text-ink/35">
        <Users className="h-3.5 w-3.5" />
        Los alumnos de tercero se administran desde la sección Alumnos.
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-raised/50 px-3 py-2">
      <dt className="text-[11px] text-ink/45">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold">{value}</dd>
    </div>
  );
}
