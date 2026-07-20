import { requireStudent } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DepositsManager } from "./DepositsManager";

export default async function DepositsPage() {
  const me = await requireStudent();
  const deposits = await prisma.fixedDeposit.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const views = deposits.map((d) => {
    const principal = Number(d.principal);
    const rate = Number(d.ratePct);
    return {
      id: d.id,
      principal,
      ratePct: rate,
      maturesAt: d.maturesAt.toISOString(),
      matured: d.maturesAt <= now,
      status: d.status,
      payout: d.payoutAmount ? Number(d.payoutAmount) : null,
      estimatedPayout: principal * (1 + rate / 100),
    };
  });
  const balance = Number(me.wallet?.balance ?? 0);

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Plazo fijo 🏦</h1>
        <p className="text-sm text-ink/50">
          Hacé crecer tu dinero con interés.
        </p>
      </div>
      <DepositsManager deposits={views} balance={balance} />
    </div>
  );
}
