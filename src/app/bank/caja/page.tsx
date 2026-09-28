import { ArrowDownToLine, ArrowUpFromLine, Wallet } from "lucide-react";
import { requireBankStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CashDesk } from "@/components/bank/CashDesk";
import { Card, CardTitle } from "@/components/ui/Card";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BankCashPage() {
  const me = await requireBankStaff();
  const bank = me.bank;
  if (!bank) return null;

  const [customers, operations, deposited, withdrawn] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT" },
      select: {
        id: true,
        name: true,
        group: { select: { name: true } },
        wallet: { select: { balance: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.cashOperation.findMany({
      where: { bankId: bank.id },
      include: {
        customer: { select: { name: true } },
        teller: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.cashOperation.aggregate({
      where: { bankId: bank.id, kind: "DEPOSIT" },
      _sum: { amount: true },
    }),
    prisma.cashOperation.aggregate({
      where: { bankId: bank.id, kind: "WITHDRAWAL" },
      _sum: { amount: true },
    }),
  ]);

  const bankBalance = Number(bank.account.wallet?.balance ?? 0);
  const totalIn = Number(deposited._sum.amount ?? 0);
  const totalOut = Number(withdrawn._sum.amount ?? 0);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Ventanilla</h1>
        <p className="text-sm text-ink/50">
          Los billetes que entran a la caja son los que después podés prestar.
          Si prestaste de más y vienen a retirar, no te va a alcanzar.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat
          icon={Wallet}
          label="Efectivo en caja"
          value={formatMoney(bankBalance)}
          tone="text-accent"
        />
        <Stat
          icon={ArrowDownToLine}
          label="Depositado en total"
          value={formatMoney(totalIn)}
          tone="text-ink"
        />
        <Stat
          icon={ArrowUpFromLine}
          label="Retirado en total"
          value={formatMoney(totalOut)}
          tone="text-violet"
        />
      </div>

      <CashDesk
        bankBalance={bankBalance}
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          group: c.group?.name ?? null,
          balance: Number(c.wallet?.balance ?? 0),
        }))}
      />

      <Card>
        <CardTitle className="mb-3">Movimientos de la ventanilla</CardTitle>
        {operations.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/40">
            Todavía no atendiste ningún depósito ni extracción.
          </p>
        ) : (
          <div className="divide-y divide-raised">
            {operations.map((op) => {
              const incoming = op.kind === "DEPOSIT";
              return (
                <div
                  key={op.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-ink/85">
                      {incoming ? "Depósito de" : "Extracción de"}{" "}
                      {op.customer.name}
                    </p>
                    <p className="truncate text-xs text-ink/40">
                      {op.note ? `${op.note} · ` : ""}
                      {op.teller ? `atendió ${op.teller.name} · ` : ""}
                      {formatDate(op.createdAt)}
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
                    {formatMoney(Number(op.amount))}
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
