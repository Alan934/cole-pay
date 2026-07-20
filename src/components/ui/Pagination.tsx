import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Paginación basada en el query param `page`.
 * `basePath` es la ruta sin query (ej: "/activity").
 */
export function Pagination({
  page,
  totalPages,
  basePath,
  totalItems,
  extraParams,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  totalItems?: number;
  extraParams?: Record<string, string>;
}) {
  if (totalPages <= 1) return null;

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const href = (p: number) => {
    const params = new URLSearchParams(extraParams);
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  };

  const linkCls =
    "inline-flex h-9 items-center gap-1 rounded-xl border border-raised2 px-3 text-sm transition-colors";

  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <p className="text-xs text-ink/40">
        Página {page} de {totalPages}
        {typeof totalItems === "number" && ` · ${totalItems} en total`}
      </p>
      <div className="flex items-center gap-2">
        {canPrev ? (
          <Link href={href(prev)} className={cn(linkCls, "hover:bg-raised")}>
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Link>
        ) : (
          <span className={cn(linkCls, "cursor-not-allowed opacity-40")}>
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </span>
        )}
        {canNext ? (
          <Link href={href(next)} className={cn(linkCls, "hover:bg-raised")}>
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className={cn(linkCls, "cursor-not-allowed opacity-40")}>
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}
