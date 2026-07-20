import {
  Wallet,
  Users,
  Coins,
  Receipt,
  Sparkles,
} from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatDate } from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/Card";
import { IssueMoneyForm } from "@/components/admin/IssueMoneyForm";
import { DepositForm } from "@/components/admin/DepositForm";
import { PrizeFineForm } from "@/components/admin/PrizeFineForm";
import { Gift } from "lucide-react";

export default async function AdminDashboard() {
  const admin = await requireAdmin();

  const [
    studentCount,
    circulationAgg,
    pendingAgg,
    students,
    recentTx,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.wallet.aggregate({
      where: { user: { role: "STUDENT" } },
      _sum: { balance: true },
    }),
    prisma.invoice.aggregate({
      where: { status: "PENDING" },
      _sum: { amount: true },
    }),
    prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { id: true, name: true, group: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.transaction.findMany({
      include: { sender: true, receiver: true },
      orderBy: { timestamp: "desc" },
      take: 8,
    }),
  ]);

  const adminBalance = Number(admin.wallet?.balance ?? 0);
  const circulation = Number(circulationAgg._sum.balance ?? 0);
  const pendingTotal = Number(pendingAgg._sum.amount ?? 0);
  const studentOptions = students.map((s) => ({
    id: s.id,
    name: s.name,
    group: s.group?.name ?? null,
  }));

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Panel de control</h1>
        <p className="text-sm text-ink/50">
          Banco Central de ColePay — gestión financiera del sistema.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={Wallet}
          label="Saldo del banco"
          value={formatMoney(adminBalance)}
          tone="text-accent"
        />
        <Stat
          icon={Users}
          label="Alumnos"
          value={studentCount.toString()}
          tone="text-violet"
        />
        <Stat
          icon={Coins}
          label="En circulación"
          value={formatMoney(circulation)}
          tone="text-ink"
        />
        <Stat
          icon={Receipt}
          label="Por cobrar"
          value={formatMoney(pendingTotal)}
          tone="text-amber-300"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Emisión monetaria */}
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet" />
            <CardTitle className="text-ink/80">Emisión monetaria</CardTitle>
          </div>
          <p className="mb-4 text-sm text-ink/50">
            Creá dinero ficticio de la nada y agregalo a tu billetera (Banco
            Central).
          </p>
          <IssueMoneyForm />
        </Card>

        {/* Cargar saldo */}
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-accent" />
            <CardTitle className="text-ink/80">
              Cargar saldo a un alumno
            </CardTitle>
          </div>
          <p className="mb-4 text-sm text-ink/50">
            Transferí desde el banco hacia un alumno (simula la entrega de
            efectivo físico).
          </p>
          <DepositForm students={studentOptions} />
        </Card>

        {/* Premios y multas */}
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Gift className="h-5 w-5 text-accent" />
            <CardTitle className="text-ink/80">Premios y multas</CardTitle>
          </div>
          <p className="mb-4 text-sm text-ink/50">
            Bonificá o descontá saldo a un alumno con un motivo (queda
            registrado y se le notifica).
          </p>
          <PrizeFineForm students={studentOptions} />
        </Card>
      </div>

      {/* Movimientos recientes */}
      <Card>
        <CardTitle className="mb-3">Movimientos recientes del sistema</CardTitle>
        {recentTx.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/40">
            Sin movimientos aún.
          </p>
        ) : (
          <div className="divide-y divide-raised">
            {recentTx.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-ink/85">{tx.description}</p>
                  <p className="truncate text-xs text-ink/40">
                    {tx.sender?.name ?? "Banco Central"} →{" "}
                    {tx.receiver?.name ?? "Sistema"} · {formatDate(tx.timestamp)}
                  </p>
                </div>
                <span className="shrink-0 font-semibold">
                  {formatMoney(Number(tx.amount))}
                </span>
              </div>
            ))}
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
