import { Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatDate } from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";

const PAGE_SIZE = 25;

const typeLabels: Record<string, { label: string; tone: "accent" | "violet" | "warning" | "neutral" }> = {
  TRANSFER: { label: "Transferencia", tone: "accent" },
  ISSUANCE: { label: "Emisión", tone: "violet" },
  DEPOSIT: { label: "Carga", tone: "accent" },
  PAYMENT: { label: "Pago", tone: "warning" },
  PRIZE: { label: "Premio", tone: "accent" },
  FINE: { label: "Multa", tone: "warning" },
  INTEREST: { label: "Interés", tone: "violet" },
  SAVINGS: { label: "Ahorro", tone: "neutral" },
};

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requireAdmin();
  const { page: pageParam, q: qParam } = await searchParams;
  const q = (qParam ?? "").trim();

  const where: Prisma.TransactionWhereInput = q
    ? {
        OR: [
          { description: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
          { sender: { name: { contains: q, mode: "insensitive" } } },
          { receiver: { name: { contains: q, mode: "insensitive" } } },
        ],
      }
    : {};

  const total = await prisma.transaction.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), totalPages);

  const transactions = await prisma.transaction.findMany({
    where,
    include: { sender: true, receiver: true },
    orderBy: { timestamp: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Transacciones del sistema</h1>
        <p className="text-sm text-ink/50">
          Historial global e inmutable de todos los movimientos.
        </p>
      </div>

      <Card className="p-0">
        <div className="flex flex-col gap-3 border-b border-raised px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Movimientos ({total})</CardTitle>
          <form method="GET" className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Buscar por descripción o persona…"
              className="h-10 pl-9 sm:w-72"
            />
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink/50">
              <tr className="border-b border-raised">
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">De</th>
                <th className="px-5 py-3 font-medium">Para</th>
                <th className="px-5 py-3 font-medium">Descripción</th>
                <th className="px-5 py-3 text-right font-medium">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-raised">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-ink/40">
                    {q ? "Sin resultados para tu búsqueda." : "Sin movimientos."}
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const t = typeLabels[tx.type] ?? {
                    label: tx.type,
                    tone: "neutral" as const,
                  };
                  return (
                    <tr key={tx.id} className="hover:bg-raised/40">
                      <td className="whitespace-nowrap px-5 py-3 text-ink/60">
                        {formatDate(tx.timestamp)}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={t.tone}>{t.label}</Badge>
                      </td>
                      <td className="px-5 py-3 text-ink/80">
                        {tx.sender?.name ?? "Banco Central"}
                      </td>
                      <td className="px-5 py-3 text-ink/80">
                        {tx.receiver?.name ?? "Sistema"}
                      </td>
                      <td className="px-5 py-3 text-ink/60">
                        {tx.description}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold">
                        {formatMoney(Number(tx.amount))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/admin/transactions"
        totalItems={total}
        extraParams={q ? { q } : undefined}
      />
    </div>
  );
}
