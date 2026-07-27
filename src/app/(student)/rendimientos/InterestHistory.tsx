"use client";

import { useRef, useState } from "react";
import { LineChart } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { formatMoney } from "@/lib/utils";
import { TIER_COLORS } from "@/lib/chart";

export type HistoryPoint = { day: string; amount: number; cumulative: number };

const W = 600;
const H = 160;
const PAD = { top: 12, right: 8, bottom: 22, left: 8 };

function shortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
  }).format(d);
}

/**
 * Evolución del interés acumulado. Una sola serie, así que no lleva leyenda:
 * el título ya dice qué se está mirando.
 */
export function InterestHistory({ data }: { data: HistoryPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.cumulative), 1);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const x = (i: number) =>
    PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const line = data.map((d, i) => `${x(i)},${y(d.cumulative)}`).join(" ");
  const area =
    `${PAD.left},${PAD.top + innerH} ` +
    line +
    ` ${x(data.length - 1)},${PAD.top + innerH}`;

  const total = data[data.length - 1]?.cumulative ?? 0;
  const active = hover !== null ? data[hover] : null;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const frac = (e.clientX - rect.left) / rect.width;
    const i = Math.round(frac * (data.length - 1));
    setHover(Math.min(data.length - 1, Math.max(0, i)));
  }

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <LineChart className="h-5 w-5" style={{ color: TIER_COLORS.balance }} />
        <CardTitle className="text-ink/80">
          Lo que te fue generando tu plata
        </CardTitle>
      </div>
      <p className="mb-1 text-2xl font-bold" style={{ color: TIER_COLORS.balance }}>
        {formatMoney(total)}
      </p>
      <p className="mb-3 text-xs text-ink/40">
        Interés acumulado desde que empezaste
      </p>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none"
          style={{ height: H }}
          role="img"
          aria-label={`Interés acumulado: ${formatMoney(total)} al ${shortDate(data[data.length - 1].day)}`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* Línea de base, recesiva */}
          <line
            x1={PAD.left}
            y1={PAD.top + innerH}
            x2={W - PAD.right}
            y2={PAD.top + innerH}
            stroke="currentColor"
            className="text-ink/15"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />

          <defs>
            <linearGradient id="interestFill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={TIER_COLORS.balance}
                stopOpacity="0.28"
              />
              <stop
                offset="100%"
                stopColor={TIER_COLORS.balance}
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          <polygon points={area} fill="url(#interestFill)" />
          <polyline
            points={line}
            fill="none"
            stroke={TIER_COLORS.balance}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Crosshair + punto activo */}
          {hover !== null && active && (
            <g>
              <line
                x1={x(hover)}
                y1={PAD.top}
                x2={x(hover)}
                y2={PAD.top + innerH}
                stroke="currentColor"
                className="text-ink/25"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              {/* Anillo del color de la superficie, para que el punto no se funda */}
              <circle
                cx={x(hover)}
                cy={y(active.cumulative)}
                r={5}
                fill={TIER_COLORS.balance}
                stroke="rgb(var(--card))"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )}

          {/* Sólo las fechas de los extremos: el resto es ruido */}
          <text
            x={PAD.left}
            y={H - 6}
            className="fill-current text-ink/40"
            style={{ fontSize: 11 }}
          >
            {shortDate(data[0].day)}
          </text>
          {data.length > 1 && (
            <text
              x={W - PAD.right}
              y={H - 6}
              textAnchor="end"
              className="fill-current text-ink/40"
              style={{ fontSize: 11 }}
            >
              {shortDate(data[data.length - 1].day)}
            </text>
          )}
        </svg>

        {active && (
          <div className="pointer-events-none absolute left-0 top-0 rounded-lg border border-raised2 bg-panel/95 px-2.5 py-1.5 text-xs shadow-card backdrop-blur">
            <p className="font-medium text-ink/80">{shortDate(active.day)}</p>
            <p className="text-ink/60">
              Ese día:{" "}
              <span className="font-semibold text-ink">
                {formatMoney(active.amount)}
              </span>
            </p>
            <p className="text-ink/60">
              Acumulado:{" "}
              <span
                className="font-semibold"
                style={{ color: TIER_COLORS.balance }}
              >
                {formatMoney(active.cumulative)}
              </span>
            </p>
          </div>
        )}
      </div>

      <details className="mt-2 border-t border-raised pt-3">
        <summary className="cursor-pointer text-xs text-ink/50 hover:text-ink/80">
          Ver los números en una tabla
        </summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-ink/50">
              <tr>
                <th className="py-1 pr-3 font-medium">Día</th>
                <th className="py-1 pr-3 font-medium">Ganaste</th>
                <th className="py-1 font-medium">Acumulado</th>
              </tr>
            </thead>
            <tbody className="text-ink/80">
              {[...data].reverse().map((d) => (
                <tr key={d.day} className="border-t border-raised">
                  <td className="py-1.5 pr-3">{shortDate(d.day)}</td>
                  <td className="py-1.5 pr-3">{formatMoney(d.amount)}</td>
                  <td className="py-1.5">{formatMoney(d.cumulative)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}
