import { cn } from "@/lib/utils";

/** Bloque gris con brillo animado, para los estados de carga. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-shimmer rounded-lg bg-raised", className)}
      {...props}
    />
  );
}

/** Tarjeta de estadística en carga (icono + label + valor). */
export function SkeletonStat() {
  return (
    <div className="rounded-2xl border border-raised2/70 bg-card/80 p-4 shadow-card">
      <div className="mb-2 flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-6 w-24" />
    </div>
  );
}

/**
 * Esqueleto genérico de página: título + N tarjetas de stat + N bloques con
 * filas. Cada `loading.tsx` lo arma con la forma de su ruta para que no haya
 * salto de layout cuando llegan los datos reales.
 */
export function PageSkeleton({
  stats = 0,
  blocks = 1,
  rows = 6,
}: {
  stats?: number;
  blocks?: number;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>

      {stats > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: stats }).map((_, i) => (
            <SkeletonStat key={i} />
          ))}
        </div>
      )}

      {Array.from({ length: blocks }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-raised2/70 bg-card/80 p-5 shadow-card"
        >
          <Skeleton className="mb-4 h-4 w-48" />
          <SkeletonRows rows={rows} />
        </div>
      ))}
    </div>
  );
}

/** Lista de filas en carga (movimientos, alumnos, etc.). */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-raised">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton
              className="h-3.5"
              style={{ width: `${55 + ((i * 13) % 30)}%` }}
            />
            <Skeleton
              className="h-2.5"
              style={{ width: `${30 + ((i * 17) % 25)}%` }}
            />
          </div>
          <Skeleton className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}
