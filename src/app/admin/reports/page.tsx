import { Download, Trophy, PiggyBank, Coins, Sparkles } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default async function ReportsPage() {
  await requireAdmin();

  const [students, issuedAgg, savedAgg, groups] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT" },
      include: {
        wallet: true,
        group: { select: { name: true } },
        savingsGoals: { select: { savedAmount: true } },
      },
    }),
    prisma.transaction.aggregate({
      where: { type: "ISSUANCE" },
      _sum: { amount: true },
    }),
    prisma.savingsGoal.aggregate({ _sum: { savedAmount: true } }),
    prisma.group.findMany({
      include: {
        users: {
          where: { role: "STUDENT" },
          select: { wallet: { select: { balance: true } } },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  // Ranking por patrimonio (saldo + ahorrado en metas).
  const ranked = students
    .map((s) => {
      const balance = Number(s.wallet?.balance ?? 0);
      const saved = s.savingsGoals.reduce(
        (acc, g) => acc + Number(g.savedAmount),
        0,
      );
      return {
        id: s.id,
        name: s.name,
        group: s.group?.name ?? null,
        balance,
        saved,
        net: balance + saved,
      };
    })
    .sort((a, b) => b.net - a.net);

  const issued = Number(issuedAgg._sum.amount ?? 0);
  const totalSaved = Number(savedAgg._sum.savedAmount ?? 0);
  const circulation = ranked.reduce((acc, r) => acc + r.balance, 0);

  const medal = ["🥇", "🥈", "🥉"];

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reportes y ranking</h1>
          <p className="text-sm text-ink/50">
            Estadísticas del grupo y exportación de datos.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/export/transactions"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-onaccent hover:bg-accent-hover"
          >
            <Download className="h-4 w-4" /> Transacciones CSV
          </a>
          <a
            href="/api/export/debtors"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-raised2 px-4 text-sm text-ink/80 hover:bg-raised"
          >
            <Download className="h-4 w-4" /> Deudores CSV
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Coins} label="En circulación" value={formatMoney(circulation)} tone="text-accent" />
        <Stat icon={Sparkles} label="Dinero emitido" value={formatMoney(issued)} tone="text-violet" />
        <Stat icon={PiggyBank} label="Total ahorrado" value={formatMoney(totalSaved)} tone="text-accent" />
        <Stat icon={Trophy} label="Alumnos" value={ranked.length.toString()} tone="text-amber-300" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Ranking */}
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-300" />
            <CardTitle className="text-ink/80">Ranking por patrimonio</CardTitle>
          </div>
          <div className="divide-y divide-raised">
            {ranked.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 py-2.5">
                <span className="w-6 text-center text-sm font-semibold text-ink/50">
                  {medal[i] ?? i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="text-xs text-ink/40">
                    Saldo {formatMoney(r.balance)} · Ahorro {formatMoney(r.saved)}
                    {r.group && ` · ${r.group}`}
                  </p>
                </div>
                <span className="shrink-0 font-bold text-accent">
                  {formatMoney(r.net)}
                </span>
              </div>
            ))}
            {ranked.length === 0 && (
              <p className="py-6 text-center text-sm text-ink/40">
                Sin alumnos todavía.
              </p>
            )}
          </div>
        </Card>

        {/* Por grupo */}
        <Card>
          <CardTitle className="mb-3">Saldo por grupo</CardTitle>
          <div className="flex flex-col gap-3">
            {groups.map((g) => {
              const total = g.users.reduce(
                (acc, u) => acc + Number(u.wallet?.balance ?? 0),
                0,
              );
              return (
                <div key={g.id} className="flex items-center justify-between">
                  <Badge tone="violet">{g.name}</Badge>
                  <span className="text-sm font-semibold">
                    {formatMoney(total)}
                  </span>
                </div>
              );
            })}
            {groups.length === 0 && (
              <p className="text-sm text-ink/40">Sin grupos.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Coins;
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
