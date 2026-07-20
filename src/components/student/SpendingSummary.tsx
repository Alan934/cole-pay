import { formatMoney } from "@/lib/utils";

const COLORS = [
  "#00e5a0",
  "#8b5cf6",
  "#f59e0b",
  "#38bdf8",
  "#f472b6",
  "#a3e635",
  "#fb7185",
];

/** Resumen visual de gastos por categoría con barras proporcionales. */
export function SpendingSummary({
  data,
}: {
  data: { category: string; total: number }[];
}) {
  const total = data.reduce((acc, d) => acc + d.total, 0);
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Barra apilada */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-raised">
        {data.map((d, i) => (
          <div
            key={d.category}
            style={{
              width: `${(d.total / total) * 100}%`,
              backgroundColor: COLORS[i % COLORS.length],
            }}
            title={`${d.category}: ${formatMoney(d.total)}`}
          />
        ))}
      </div>

      {/* Leyenda */}
      <div className="flex flex-col gap-2">
        {data.map((d, i) => {
          const pct = Math.round((d.total / total) * 100);
          return (
            <div
              key={d.category}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2 text-ink/70">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                {d.category}
                <span className="text-xs text-ink/40">{pct}%</span>
              </span>
              <span className="font-medium">{formatMoney(d.total)}</span>
            </div>
          );
        })}
        <div className="mt-1 flex items-center justify-between border-t border-raised pt-2 text-sm">
          <span className="text-ink/50">Total gastado</span>
          <span className="font-bold">{formatMoney(total)}</span>
        </div>
      </div>
    </div>
  );
}
