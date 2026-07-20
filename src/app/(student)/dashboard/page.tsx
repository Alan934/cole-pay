import Link from "next/link";
import {
  ArrowLeftRight,
  Receipt,
  Clock,
  QrCode,
  Target,
  Landmark,
  PieChart,
} from "lucide-react";
import { requireStudent } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toTxView } from "@/lib/tx";
import { formatMoney } from "@/lib/utils";
import { BalanceCard } from "@/components/student/BalanceCard";
import { TransactionRow } from "@/components/student/TransactionRow";
import { SpendingSummary } from "@/components/student/SpendingSummary";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const QUICK_ACTIONS = [
  { href: "/transfer", label: "Enviar", sub: "Transferir", icon: ArrowLeftRight, tone: "bg-accent/15 text-accent" },
  { href: "/request", label: "Cobrar", sub: "QR / pedir", icon: QrCode, tone: "bg-violet/15 text-violet" },
  { href: "/goals", label: "Metas", sub: "Ahorrar", icon: Target, tone: "bg-accent/15 text-accent" },
  { href: "/deposits", label: "Plazo fijo", sub: "Ganar interés", icon: Landmark, tone: "bg-violet/15 text-violet" },
];

export default async function DashboardPage() {
  const me = await requireStudent();

  const [transactions, pendingBills, pendingTotalAgg, spendingRaw, savedAgg] =
    await Promise.all([
      prisma.transaction.findMany({
        where: { OR: [{ senderId: me.id }, { receiverId: me.id }] },
        include: { sender: true, receiver: true },
        orderBy: { timestamp: "desc" },
        take: 5,
      }),
      prisma.invoice.count({ where: { studentId: me.id, status: "PENDING" } }),
      prisma.invoice.aggregate({
        where: { studentId: me.id, status: "PENDING" },
        _sum: { amount: true },
      }),
      // Egresos reales por categoría (excluye ahorro interno).
      prisma.transaction.groupBy({
        by: ["category"],
        where: {
          senderId: me.id,
          type: { in: ["TRANSFER", "PAYMENT", "FINE"] },
        },
        _sum: { amount: true },
      }),
      prisma.savingsGoal.aggregate({
        where: { userId: me.id, status: { not: "ARCHIVED" } },
        _sum: { savedAmount: true },
      }),
    ]);

  const balance = Number(me.wallet?.balance ?? 0);
  const pendingTotal = Number(pendingTotalAgg._sum.amount ?? 0);
  const saved = Number(savedAgg._sum.savedAmount ?? 0);
  const txViews = transactions.map((t) => toTxView(t, me.id));

  const spending = spendingRaw
    .map((s) => ({
      category: s.category ?? "General",
      total: Number(s._sum.amount ?? 0),
    }))
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <p className="text-sm text-ink/50">Hola,</p>
        <h1 className="text-xl font-bold">{me.name.split(" ")[0]} 👋</h1>
      </div>

      <BalanceCard
        balance={balance}
        cvu={me.wallet?.cvu ?? "—"}
        alias={me.wallet?.alias ?? "—"}
      />

      {saved > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-raised bg-card/60 px-4 py-2.5 text-sm">
          <span className="flex items-center gap-2 text-ink/60">
            <Target className="h-4 w-4 text-accent" /> Ahorrado en metas
          </span>
          <span className="font-semibold text-accent">{formatMoney(saved)}</span>
        </div>
      )}

      {/* Accesos rápidos */}
      <div className="grid grid-cols-4 gap-2">
        {QUICK_ACTIONS.map((a) => (
          <Link key={a.href} href={a.href}>
            <Card className="flex flex-col items-center gap-2 p-3 text-center transition-colors hover:border-accent/40">
              <div className={`grid h-11 w-11 place-items-center rounded-xl ${a.tone}`}>
                <a.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold leading-tight">{a.label}</p>
                <p className="text-[10px] text-ink/40">{a.sub}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Resumen de deudas */}
      {pendingBills > 0 && (
        <Link href="/bills">
          <Card className="flex items-center justify-between border-amber-500/25 bg-amber-500/5">
            <div>
              <CardTitle className="text-amber-300/80">
                Tenés {pendingBills} cuenta(s) por pagar
              </CardTitle>
              <p className="mt-0.5 text-lg font-bold">
                {formatMoney(pendingTotal)}
              </p>
            </div>
            <Badge tone="warning">Pendiente</Badge>
          </Card>
        </Link>
      )}

      {/* Resumen de gastos */}
      {spending.length > 0 && (
        <div>
          <div className="mb-1 flex items-center gap-2 px-1">
            <PieChart className="h-4 w-4 text-ink/50" />
            <h2 className="text-sm font-semibold text-ink/70">
              En qué gastás
            </h2>
          </div>
          <Card>
            <SpendingSummary data={spending} />
          </Card>
        </div>
      )}

      {/* Actividad reciente */}
      <div>
        <div className="mb-1 flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-ink/70">
            Actividad reciente
          </h2>
          <Link
            href="/activity"
            className="text-xs font-medium text-accent hover:underline"
          >
            Ver todo
          </Link>
        </div>
        <Card className="py-1">
          {txViews.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-ink/40">
              <Clock className="h-8 w-8" />
              <p className="text-sm">Todavía no hay movimientos.</p>
            </div>
          ) : (
            <div className="divide-y divide-raised">
              {txViews.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
