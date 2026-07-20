import { requireStudent } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { GoalsManager } from "./GoalsManager";

export default async function GoalsPage() {
  const me = await requireStudent();
  const goals = await prisma.savingsGoal.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
  });

  const views = goals.map((g) => ({
    id: g.id,
    name: g.name,
    target: Number(g.targetAmount),
    saved: Number(g.savedAmount),
    completed: g.status === "COMPLETED",
  }));
  const balance = Number(me.wallet?.balance ?? 0);

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Metas de ahorro 🎯</h1>
        <p className="text-sm text-ink/50">
          Apartá dinero de tu saldo para lograr lo que querés.
        </p>
      </div>
      <GoalsManager goals={views} balance={balance} />
    </div>
  );
}
