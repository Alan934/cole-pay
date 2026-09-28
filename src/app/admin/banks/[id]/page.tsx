import { notFound } from "next/navigation";
import { Coins, CreditCard, Settings, Users, Wallet } from "lucide-react";
import { requireBankAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { bankCardInclude, toBankCardView } from "@/lib/card-views";
import { cardBalance } from "@/lib/cards";
import { formatMoney } from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BankCardRow } from "@/components/cards/BankCardRow";
import { ClosePeriodForm } from "@/components/cards/ClosePeriodForm";
import { BankForm } from "../BankForm";
import { EmployeesPanel } from "./EmployeesPanel";
import { FundBankForm } from "./FundBankForm";

export const dynamic = "force-dynamic";

export default async function BankDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireBankAdminSession();
  const { id } = await params;

  const bank = await prisma.bank.findUnique({
    where: { id },
    include: {
      account: { select: { wallet: true } },
      employees: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true },
      },
      cards: { include: bankCardInclude, orderBy: { issuedAt: "desc" } },
      applications: { where: { status: "PENDING" }, select: { id: true } },
    },
  });
  if (!bank) notFound();

  // Alumnos de quinto que todavía no están en este banco. Los que no tienen
  // ninguno van explícitos: `bankId <> id` no los trae (en SQL, comparar con
  // NULL no da verdadero), y son justamente los que hay que asignar.
  const available = await prisma.user.findMany({
    where: {
      role: "BANK_EMPLOYEE",
      OR: [{ bankId: null }, { bankId: { not: bank.id } }],
    },
    // Primero los que están sin banco: son los que quedan esperando trabajo.
    orderBy: [{ bankId: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      bank: { select: { name: true } },
    },
  });

  const cardViews = bank.cards.map(toBankCardView);
  const balance = Number(bank.account.wallet?.balance ?? 0);
  const lent = bank.cards
    .filter((c) => c.status !== "CANCELLED")
    .reduce((acc, c) => acc + cardBalance(c).debt, 0);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="h-12 w-12 shrink-0 rounded-xl"
            style={{ backgroundColor: bank.color }}
          />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{bank.name}</h1>
            <p className="text-sm text-ink/50">
              Alias {bank.account.wallet?.alias ?? "—"} · CVU{" "}
              {bank.account.wallet?.cvu ?? "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bank.active ? (
            <Badge tone="success">Abierto</Badge>
          ) : (
            <Badge tone="neutral">Cerrado</Badge>
          )}
          {bank.applications.length > 0 && (
            <Badge tone="warning">
              {bank.applications.length} solicitudes pendientes
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Wallet} label="Caja" value={formatMoney(balance)} tone="text-accent" />
        <Stat
          icon={Coins}
          label="Prestado"
          value={formatMoney(lent)}
          tone="text-violet"
        />
        <Stat
          icon={CreditCard}
          label="Tarjetas"
          value={cardViews.length.toString()}
          tone="text-ink"
        />
        <Stat
          icon={Users}
          label="Empleados"
          value={bank.employees.length.toString()}
          tone="text-ink"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Coins className="h-5 w-5 text-accent" />
            <CardTitle className="text-ink/80">Capitalizar</CardTitle>
          </div>
          <p className="mb-4 text-sm text-ink/50">
            El banco adelanta la plata de cada compra con tarjeta. Si la caja
            queda en cero, las compras de sus clientes se rechazan.
          </p>
          <FundBankForm bankId={bank.id} />

          <div className="mt-5 border-t border-raised2/60 pt-4">
            <CardTitle className="mb-2 text-ink/80">
              Cierre de período
            </CardTitle>
            <p className="mb-3 text-sm text-ink/50">
              Si el banco no lo hace, podés emitir vos los resúmenes de todas
              sus tarjetas.
            </p>
            <ClosePeriodForm bankId={bank.id} />
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-5 w-5 text-violet" />
            <CardTitle className="text-ink/80">Equipo del banco</CardTitle>
          </div>
          <EmployeesPanel
            bankId={bank.id}
            employees={bank.employees.map((e) => ({
              ...e,
              currentBank: bank.name,
            }))}
            available={available.map((e) => ({
              id: e.id,
              name: e.name,
              email: e.email,
              currentBank: e.bank?.name ?? null,
            }))}
          />
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Settings className="h-5 w-5 text-ink/60" />
          <CardTitle className="text-ink/80">Datos y política de crédito</CardTitle>
        </div>
        <p className="mb-4 text-sm text-ink/50">
          Los cambios valen para las tarjetas que se emitan de ahora en más: las
          ya emitidas conservan las condiciones con las que salieron.
        </p>
        <BankForm
          bank={{
            id: bank.id,
            name: bank.name,
            color: bank.color,
            active: bank.active,
            defaultLimit: Number(bank.defaultLimit),
            monthlyRatePct: Number(bank.monthlyRatePct),
            closingDay: bank.closingDay,
            dueDays: bank.dueDays,
            loanRatePct: Number(bank.loanRatePct),
            maxLoanAmount: Number(bank.maxLoanAmount),
          }}
        />
      </Card>

      {cardViews.length > 0 && (
        <div className="flex flex-col gap-3">
          <CardTitle>Tarjetas emitidas por {bank.name}</CardTitle>
          {cardViews.map((card) => (
            <BankCardRow key={card.id} card={card} />
          ))}
        </div>
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
      <p className={`truncate text-xl font-bold ${tone}`}>{value}</p>
    </Card>
  );
}
