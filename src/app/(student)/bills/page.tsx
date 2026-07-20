import { CheckCircle2, Receipt } from "lucide-react";
import { requireStudent } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatDate } from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PayButton } from "./PayButton";

export default async function BillsPage() {
  const me = await requireStudent();
  const balance = Number(me.wallet?.balance ?? 0);

  const [pending, paid] = await Promise.all([
    prisma.invoice.findMany({
      where: { studentId: me.id, status: "PENDING" },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.invoice.findMany({
      where: { studentId: me.id, status: "PAID" },
      orderBy: { paidAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Cuentas a pagar</h1>
        <p className="text-sm text-ink/50">
          Servicios y cobros asignados por tus profes.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        {pending.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-10 text-center text-ink/50">
            <CheckCircle2 className="h-10 w-10 text-accent" />
            <p className="text-sm">¡Estás al día! No tenés cuentas pendientes.</p>
          </Card>
        ) : (
          pending.map((inv) => {
            const amount = Number(inv.amount);
            const canPay = balance >= amount;
            return (
              <Card key={inv.id} className="flex items-center gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
                  <Receipt className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{inv.description}</p>
                  <p className="text-lg font-bold">{formatMoney(amount)}</p>
                  {inv.dueDate && (
                    <p className="text-xs text-ink/40">
                      Vence: {formatDate(inv.dueDate)}
                    </p>
                  )}
                  {!canPay && (
                    <p className="mt-0.5 text-xs text-red-300">
                      Saldo insuficiente
                    </p>
                  )}
                </div>
                <PayButton invoiceId={inv.id} />
              </Card>
            );
          })
        )}
      </section>

      {paid.length > 0 && (
        <section>
          <CardTitle className="mb-2 px-1">Pagadas recientemente</CardTitle>
          <Card className="divide-y divide-raised py-1">
            {paid.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink/80">
                    {inv.description}
                  </p>
                  {inv.paidAt && (
                    <p className="text-xs text-ink/40">
                      {formatDate(inv.paidAt)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink/60">
                    {formatMoney(Number(inv.amount))}
                  </span>
                  <Badge tone="success">Pagada</Badge>
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
