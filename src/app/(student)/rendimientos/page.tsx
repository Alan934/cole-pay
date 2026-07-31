import { TrendingUp, Info, Flame } from "lucide-react";
import { requireStudent } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getSettingsView, getActiveTerms } from "@/lib/settings";
import {
  simpleInterest,
  tnaToTea,
  monthlyToAnnualInflation,
  realRate,
} from "@/lib/interest";
import { formatMoney } from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/Card";
import { YieldCalculator } from "./YieldCalculator";
import { InterestHistory } from "./InterestHistory";
import { Glossary } from "./Glossary";
import { Quiz } from "./Quiz";

export default async function YieldsPage() {
  const me = await requireStudent();

  const [settings, terms, goalsAgg, accruals, earnedAgg, attempts] =
    await Promise.all([
      getSettingsView(),
      getActiveTerms(),
      prisma.savingsGoal.aggregate({
        where: { userId: me.id, status: { not: "ARCHIVED" } },
        _sum: { savedAmount: true, earnedInterest: true },
      }),
      prisma.interestAccrual.findMany({
        where: { userId: me.id },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, interest: true },
      }),
      prisma.interestAccrual.aggregate({
        where: { userId: me.id },
        _sum: { interest: true },
      }),
      prisma.quizAttempt.findMany({
        where: { userId: me.id, correct: true },
        select: { questionId: true },
      }),
    ]);

  const balance = Number(me.wallet?.balance ?? 0);
  const saved = Number(goalsAgg._sum.savedAmount ?? 0);
  const goalsEarned = Number(goalsAgg._sum.earnedInterest ?? 0);
  const totalEarned = Number(earnedAgg._sum.interest ?? 0);
  const bestTna = terms.reduce((max, t) => Math.max(max, Number(t.tnaPct)), 0);

  // Interés acumulado día a día, para el gráfico.
  const byDay = new Map<string, number>();
  for (const a of accruals) {
    const key = a.createdAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + Number(a.interest));
  }
  let running = 0;
  const history = [...byDay.entries()].map(([day, amount]) => {
    running += amount;
    return { day, amount, cumulative: Math.round(running * 100) / 100 };
  });

  const perDayBalance = simpleInterest(balance, settings.balanceTnaPct, 1);
  const perDayGoals = simpleInterest(saved, settings.goalsTnaPct, 1);
  const annualInflation = monthlyToAnnualInflation(settings.monthlyInflationPct);
  const real = realRate(settings.balanceTnaPct, annualInflation);
  const solved = new Set(attempts.map((a) => a.questionId));

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Rendimientos 📈</h1>
        <p className="text-sm text-ink/50">
          Tu plata puede trabajar sola. Acá aprendés cómo y cuánto.
        </p>
      </div>

      {!settings.interestEnabled ? (
        <Card className="flex flex-col items-center gap-2 py-8 text-center text-ink/50">
          <TrendingUp className="h-8 w-8" />
          <p className="text-sm">
            El banco todavía no está pagando intereses. Igual podés usar la
            calculadora y el simulador de acá abajo para practicar.
          </p>
        </Card>
      ) : (
        <Card className="border-accent/25 bg-accent/5">
          <CardTitle className="mb-3">Tu dinero ahora mismo</CardTitle>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-ink/50">Saldo disponible</p>
              <p className="text-lg font-bold">{formatMoney(balance)}</p>
              <p className="text-xs text-ink/40">
                {settings.balanceTnaPct}% TNA · genera{" "}
                <span className="font-medium text-accent">
                  {formatMoney(perDayBalance)}
                </span>{" "}
                por día
              </p>
            </div>
            <div>
              <p className="text-xs text-ink/50">Apartado en metas</p>
              <p className="text-lg font-bold">{formatMoney(saved)}</p>
              <p className="text-xs text-ink/40">
                {settings.goalsTnaPct}% TNA · genera{" "}
                <span className="font-medium text-accent">
                  {formatMoney(perDayGoals)}
                </span>{" "}
                por día
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-accent/20 pt-3">
            <span className="text-sm text-ink/60">
              Ganaste en intereses hasta hoy
            </span>
            <span className="text-xl font-bold text-accent">
              {formatMoney(totalEarned)}
            </span>
          </div>
          {goalsEarned > 0 && (
            <p className="mt-1 text-xs text-ink/40">
              De eso, {formatMoney(goalsEarned)} se sumaron directo a tus metas.
            </p>
          )}
        </Card>
      )}

      {settings.interestEnabled && (
        <Card className="border-violet/25 bg-violet/5">
          <div className="mb-1 flex items-center gap-2">
            <Info className="h-4 w-4 text-violet" />
            <CardTitle className="text-ink/80">
              TNA {settings.balanceTnaPct}% pero TEA{" "}
              {tnaToTea(settings.balanceTnaPct)}%
            </CardTitle>
          </div>
          <p className="text-sm leading-relaxed text-ink/60">
            Como el interés se te acredita todos los días y queda en la cuenta,
            al día siguiente ese interés también genera interés. Por eso en un
            año terminás ganando{" "}
            <span className="font-semibold text-violet">
              {tnaToTea(settings.balanceTnaPct)}%
            </span>{" "}
            y no {settings.balanceTnaPct}%. Eso es el{" "}
            <span className="font-semibold">interés compuesto</span>.
          </p>
        </Card>
      )}

      {settings.inflationEnabled && settings.monthlyInflationPct > 0 && (
        <Card
          className={
            real < 0
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-accent/25 bg-accent/5"
          }
        >
          <div className="mb-1 flex items-center gap-2">
            <Flame className="h-4 w-4 text-amber-300" />
            <CardTitle className="text-ink/80">
              Tasa real: {real}% anual
            </CardTitle>
          </div>
          <p className="text-sm leading-relaxed text-ink/60">
            Los precios suben {settings.monthlyInflationPct}% por mes, que es{" "}
            {annualInflation}% al año. Tu saldo rinde{" "}
            {settings.balanceTnaPct}%.{" "}
            {real < 0 ? (
              <>
                Como los precios corren más rápido que tu plata, tenés{" "}
                <span className="font-semibold text-amber-300">
                  más pesos pero comprás menos cosas
                </span>
                . Ahí conviene buscar un plazo con mejor tasa.
              </>
            ) : (
              <>
                Tu plata le gana a los precios: estás{" "}
                <span className="font-semibold text-accent">
                  ganando poder de compra
                </span>
                .
              </>
            )}
          </p>
        </Card>
      )}

      {history.length > 0 && <InterestHistory data={history} />}

      <YieldCalculator
        balanceTnaPct={settings.balanceTnaPct}
        goalsTnaPct={settings.goalsTnaPct}
        bestDepositTnaPct={bestTna}
        terms={terms.map((t) => ({ days: t.days, tnaPct: Number(t.tnaPct) }))}
        suggestedAmount={Math.max(1000, Math.round(balance) || 10000)}
      />

      <Glossary />

      <Quiz solvedIds={[...solved]} />
    </div>
  );
}
