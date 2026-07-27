"use client";

import { useMemo, useState } from "react";
import { Calculator, Scale } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { formatMoney } from "@/lib/utils";
import { breakdown, simpleInterest, DAYS_IN_YEAR } from "@/lib/interest";
import { TIER_COLORS } from "@/lib/chart";

type Term = { days: number; tnaPct: number };

const DAY_PRESETS = [7, 14, 30, 90, 180, 365];

export function YieldCalculator({
  balanceTnaPct,
  goalsTnaPct,
  bestDepositTnaPct,
  terms,
  suggestedAmount,
}: {
  balanceTnaPct: number;
  goalsTnaPct: number;
  bestDepositTnaPct: number;
  terms: Term[];
  suggestedAmount: number;
}) {
  const [amount, setAmount] = useState(String(suggestedAmount));
  const [days, setDays] = useState(30);
  const [tna, setTna] = useState(
    balanceTnaPct > 0 ? balanceTnaPct : bestDepositTnaPct || 50,
  );

  const principal = Number(amount);
  const valid = Number.isFinite(principal) && principal > 0;
  const calc = useMemo(
    () => (valid ? breakdown(principal, tna, days) : null),
    [principal, tna, days, valid],
  );

  // El plazo fijo sólo puede usar los plazos que ofrece el banco: se elige el
  // más largo que entre en la cantidad de días simulada.
  const usableTerm = useMemo(() => {
    const fits = terms.filter((t) => t.days <= days);
    if (fits.length === 0) return null;
    return fits.reduce((a, b) => (b.days > a.days ? b : a));
  }, [terms, days]);

  const tiers = useMemo(() => {
    if (!valid) return [];
    const depositInterest = usableTerm
      ? // Se renueva el plazo tantas veces como entre en el período.
        simpleInterest(
          principal,
          usableTerm.tnaPct,
          Math.floor(days / usableTerm.days) * usableTerm.days,
        )
      : 0;
    return [
      {
        key: "balance" as const,
        label: "Saldo disponible",
        note: "Lo usás cuando querés",
        tnaPct: balanceTnaPct,
        interest: simpleInterest(principal, balanceTnaPct, days),
      },
      {
        key: "goal" as const,
        label: "Meta de ahorro",
        note: "Con permanencia mínima",
        tnaPct: goalsTnaPct,
        interest: simpleInterest(principal, goalsTnaPct, days),
      },
      {
        key: "deposit" as const,
        label: "Plazo fijo",
        note: usableTerm
          ? `Inmovilizado ${usableTerm.days} días`
          : "No entra ningún plazo",
        tnaPct: usableTerm?.tnaPct ?? 0,
        interest: depositInterest,
      },
    ];
  }, [valid, principal, days, balanceTnaPct, goalsTnaPct, usableTerm]);

  const maxInterest = Math.max(...tiers.map((t) => t.interest), 1);

  return (
    <div className="flex flex-col gap-5">
      {/* ------------------------------ Calculadora ----------------------- */}
      <Card>
        <div className="mb-1 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-accent" />
          <CardTitle className="text-ink/80">Calculadora de intereses</CardTitle>
        </div>
        <p className="mb-4 text-sm text-ink/50">
          Cambiá los números y mirá cómo se arma la cuenta.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="calc-amount">Capital</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40">
                $
              </span>
              <Input
                id="calc-amount"
                type="number"
                min="0"
                step="0.01"
                className="pl-7"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="calc-days">Días</Label>
            <Select
              id="calc-days"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {DAY_PRESETS.map((d) => (
                <option key={d} value={d}>
                  {d} días
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="calc-tna">TNA (%)</Label>
            <Input
              id="calc-tna"
              type="number"
              min="0"
              step="0.01"
              value={tna}
              onChange={(e) => setTna(Number(e.target.value))}
            />
          </div>
        </div>

        {calc && (
          <div className="mt-4 rounded-xl border border-raised bg-raised/30 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink/50">
              Paso a paso
            </p>
            <ol className="flex flex-col gap-2 text-sm">
              <li className="flex flex-col gap-0.5">
                <span className="text-ink/50">
                  1. La fórmula del interés simple:
                </span>
                <span className="font-mono text-xs text-ink/80">
                  capital × (TNA ÷ 100) × (días ÷ {DAYS_IN_YEAR})
                </span>
              </li>
              <li className="flex flex-col gap-0.5">
                <span className="text-ink/50">2. Con tus números:</span>
                <span className="font-mono text-xs text-ink/80">
                  {calc.formula}
                </span>
              </li>
              <li className="flex flex-col gap-0.5">
                <span className="text-ink/50">
                  3. Esa TNA, en {calc.days} días, es en realidad:
                </span>
                <span className="font-mono text-xs text-ink/80">
                  {calc.periodRatePct}% del capital
                </span>
              </li>
            </ol>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-raised pt-3">
              <span className="text-sm text-ink/60">
                Interés:{" "}
                <span className="text-base font-bold text-accent">
                  {formatMoney(calc.interest)}
                </span>
              </span>
              <span className="text-sm text-ink/60">
                Total:{" "}
                <span className="text-base font-bold">
                  {formatMoney(calc.total)}
                </span>
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* ------------------------------ Comparador ------------------------ */}
      <Card>
        <div className="mb-1 flex items-center gap-2">
          <Scale className="h-5 w-5 text-violet" />
          <CardTitle className="text-ink/80">
            ¿Dónde conviene poner la plata?
          </CardTitle>
        </div>
        <p className="mb-4 text-sm text-ink/50">
          Los mismos {valid ? formatMoney(principal) : "$0"} en cada opción,
          durante {days} días. Mientras menos disponible tengas la plata, más te
          pagan.
        </p>

        {valid ? (
          <>
            <ul className="flex flex-col gap-4">
              {tiers.map((t) => (
                <li key={t.key}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: TIER_COLORS[t.key] }}
                      />
                      {t.label}
                    </span>
                    <span className="shrink-0 text-sm font-semibold">
                      {formatMoney(t.interest)}
                    </span>
                  </div>
                  {/* Barra: extremo redondeado, anclada a la línea de base. */}
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-raised/60">
                    <div
                      className="h-full rounded-full transition-[width] duration-300"
                      style={{
                        width: `${Math.max(1.5, (t.interest / maxInterest) * 100)}%`,
                        backgroundColor: TIER_COLORS[t.key],
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink/40">
                    {t.tnaPct > 0 ? `${t.tnaPct}% TNA · ` : ""}
                    {t.note}
                  </p>
                </li>
              ))}
            </ul>

            <details className="mt-4 border-t border-raised pt-3">
              <summary className="cursor-pointer text-xs text-ink/50 hover:text-ink/80">
                Ver los números en una tabla
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-ink/50">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Opción</th>
                      <th className="py-1 pr-3 font-medium">TNA</th>
                      <th className="py-1 pr-3 font-medium">Interés</th>
                      <th className="py-1 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="text-ink/80">
                    {tiers.map((t) => (
                      <tr key={t.key} className="border-t border-raised">
                        <td className="py-1.5 pr-3">{t.label}</td>
                        <td className="py-1.5 pr-3">{t.tnaPct}%</td>
                        <td className="py-1.5 pr-3">
                          {formatMoney(t.interest)}
                        </td>
                        <td className="py-1.5">
                          {formatMoney(principal + t.interest)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <p className="mt-3 text-xs leading-relaxed text-ink/50">
              A esto se le llama <strong>liquidez</strong>: poder usar la plata
              cuando querés. El banco te paga más justamente cuando resignás esa
              libertad.
            </p>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-ink/40">
            Cargá un capital arriba para comparar.
          </p>
        )}
      </Card>
    </div>
  );
}
