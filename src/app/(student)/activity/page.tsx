import { Clock } from "lucide-react";
import { requireStudent } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toTxView } from "@/lib/tx";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { TransactionRow } from "@/components/student/TransactionRow";

const PAGE_SIZE = 15;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const me = await requireStudent();
  const { page: pageParam } = await searchParams;

  const where = {
    OR: [{ senderId: me.id }, { receiverId: me.id }],
  };
  const total = await prisma.transaction.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(
    Math.max(1, Number(pageParam) || 1),
    totalPages,
  );

  const transactions = await prisma.transaction.findMany({
    where,
    include: { sender: true, receiver: true },
    orderBy: { timestamp: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const txViews = transactions.map((t) => toTxView(t, me.id));

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Actividad</h1>
        <p className="text-sm text-ink/50">Todos tus movimientos.</p>
      </div>

      <Card className="py-1">
        {txViews.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-ink/40">
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

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/activity"
        totalItems={total}
      />
    </div>
  );
}
