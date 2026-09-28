import { requireBankStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TX_TYPE_LABELS } from "@/lib/tx";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BankAccountPage() {
  const me = await requireBankStaff();
  const bank = me.bank;
  if (!bank) return null;

  const accountId = bank.accountId;
  const [movements, inAgg, outAgg] = await Promise.all([
    prisma.transaction.findMany({
      where: { OR: [{ senderId: accountId }, { receiverId: accountId }] },
      include: {
        sender: { select: { name: true } },
        receiver: { select: { name: true } },
      },
      orderBy: { timestamp: "desc" },
      take: 60,
    }),
    prisma.transaction.aggregate({
      where: { receiverId: accountId },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { senderId: accountId },
      _sum: { amount: true },
    }),
  ]);

  const balance = Number(bank.account.wallet?.balance ?? 0);
  const income = Number(inAgg._sum.amount ?? 0);
  const outflow = Number(outAgg._sum.amount ?? 0);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Cuenta del banco</h1>
        <p className="text-sm text-ink/50">
          De acá sale la plata que adelantás en cada compra con tarjeta, y acá
          entran los pagos de los resúmenes.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-ink/50">Saldo actual</p>
          <p className="mt-1 text-2xl font-bold text-accent">
            {formatMoney(balance)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink/50">Entró en total</p>
          <p className="mt-1 text-2xl font-bold">{formatMoney(income)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-ink/50">Salió en total</p>
          <p className="mt-1 text-2xl font-bold">{formatMoney(outflow)}</p>
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Movimientos</CardTitle>
          <div className="flex items-center gap-2 text-xs text-ink/45">
            <span>Alias</span>
            <Badge tone="neutral">{bank.account.wallet?.alias ?? "—"}</Badge>
            <span>CVU</span>
            <Badge tone="neutral">{bank.account.wallet?.cvu ?? "—"}</Badge>
          </div>
        </div>

        {movements.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/40">
            Todavía no hubo movimientos en la cuenta.
          </p>
        ) : (
          <div className="divide-y divide-raised">
            {movements.map((tx) => {
              const incoming = tx.receiverId === accountId;
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-ink/85">{tx.description}</p>
                    <p className="truncate text-xs text-ink/40">
                      {TX_TYPE_LABELS[tx.type] ?? tx.type} ·{" "}
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
