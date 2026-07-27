import { TrendingUp, Coins, Users, Flame } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getSettingsView } from "@/lib/settings";
import { formatMoney } from "@/lib/utils";
import { tnaToTea, monthlyToAnnualInflation, realRate } from "@/lib/interest";
import { Card, CardTitle } from "@/components/ui/Card";
import { YieldsManager } from "./YieldsManager";

export default async function AdminYieldsPage() {
  await requireAdmin();

  const [settings, terms, runs, interestAgg, topEarners] = await Promise.all([
    getSettingsView(),
    prisma.depositTerm.findMany({ orderBy: { days: "asc" } }),
    prisma.interestRun.findMany({ orderBy: { runAt: "desc" }, take: 12 }),
    prisma.transaction.aggregate({
      where: { type: "INTEREST" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.interestAccrual.groupBy({
      by: ["userId"],
      _sum: { interest: true },
      orderBy: { _sum: { interest: "desc" } },
      take: 5,
    }),
  ]);

  const earnerNames = await prisma.user.findMany({
    where: { id: { in: topEarners.map((t) => t.userId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(earnerNames.map((u) => [u.id, u.name]));

  const totalInterest = Number(interestAgg._sum.amount ?? 0);
  const annualInflation = monthlyToAnnualInflation(settings.monthlyInflationPct);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Rendimientos</h1>
        <p className="text-sm text-ink/50">
          Definí cuánto paga el banco por el dinero de los alumnos. Los
          intereses se acreditan solos una vez por día.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={TrendingUp}
          label="TNA del saldo"
          value={`${settings.balanceTnaPct}%`}
          hint={`TEA ${tnaToTea(settings.balanceTnaPct)}%`}
          tone="text-accent"
        />
        <Stat
          icon={Coins}
          label="Emitido en intereses"
          value={formatMoney(totalInterest)}
          hint={`${interestAgg._count} acreditación(es)`}
          tone="text-violet"
        />
        <Stat
          icon={Users}
          label="Última liquidación"
          value={
            settings.lastAccrualAt
              ? new Intl.DateTimeFormat("es-AR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(settings.lastAccrualAt)
              : "Nunca"
          }
          hint={settings.interestEnabled ? "Sistema activo" : "Desactivado"}
          tone={settings.interestEnabled ? "text-ink" : "text-ink/40"}
        />
        <Stat
          icon={Flame}
          label="Inflación mensual"
          value={`${settings.monthlyInflationPct}%`}
          hint={
            settings.inflationEnabled
              ? `${annualInflation}% anual`
              : "Desactivada"
          }
          tone={settings.inflationEnabled ? "text-amber-300" : "text-ink/40"}
        />
      </div>

      {settings.interestEnabled && settings.inflationEnabled && (
        <Card
          className={
            realRate(settings.balanceTnaPct, annualInflation) < 0
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-accent/30 bg-accent/5"
          }
        >
          <CardTitle className="mb-1">Tasa real del saldo disponible</CardTitle>
          <p className="text-2xl font-bold">
            {realRate(settings.balanceTnaPct, annualInflation)}%
          </p>
          <p className="mt-1 text-sm text-ink/60">
            {realRate(settings.balanceTnaPct, annualInflation) < 0
              ? "Negativa: los precios suben más rápido que el dinero de los alumnos. Dejar la plata quieta les hace perder poder de compra — perfecto para discutirlo en clase."
              : "Positiva: el rendimiento le gana a la inflación y los alumnos ganan poder de compra."}
          </p>
        </Card>
      )}

      <YieldsManager
        settings={settings}
        terms={terms.map((t) => ({
          id: t.id,
          days: t.days,
          tnaPct: Number(t.tnaPct),
          active: t.active,
        }))}
        runs={runs.map((r) => ({
          id: r.id,
          runAt: r.runAt.toISOString(),
          days: r.days,
          totalPaid: Number(r.totalPaid),
          walletsCount: r.walletsCount,
          trigger: r.trigger,
        }))}
        topEarners={topEarners.map((t) => ({
          name: nameById.get(t.userId) ?? "—",
          total: Number(t._sum.interest ?? 0),
        }))}
      />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  hint?: string;
  tone: string;
}) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${tone}`} />
        <span className="text-xs text-ink/50">{label}</span>
      </div>
      <p className={`text-xl font-bold ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink/40">{hint}</p>}
    </Card>
  );
}
