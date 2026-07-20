import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { RecurringManager } from "./RecurringManager";

export default async function RecurringPage() {
  await requireAdmin();
  const now = new Date();

  const [charges, groups] = await Promise.all([
    prisma.recurringCharge.findMany({
      include: { group: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.group.findMany({ orderBy: { name: "asc" } }),
  ]);

  const views = charges.map((c) => ({
    id: c.id,
    description: c.description,
    amount: Number(c.amount),
    intervalDays: c.intervalDays,
    active: c.active,
    groupName: c.group?.name ?? null,
    nextRunAt: c.nextRunAt.toISOString(),
    due: c.nextRunAt <= now,
  }));
  const dueCount = views.filter((v) => v.active && v.due).length;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Cobros recurrentes</h1>
        <p className="text-sm text-ink/50">
          Programá cobros que se repiten (ej: alquiler semanal). Generalos con un
          clic cuando venzan.
        </p>
      </div>
      <RecurringManager
        charges={views}
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        dueCount={dueCount}
      />
    </div>
  );
}
