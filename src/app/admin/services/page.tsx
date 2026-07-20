import { Receipt, CheckCircle2, Clock } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/Card";
import { CreateInvoiceForm } from "./CreateInvoiceForm";
import { InvoicesTable } from "./InvoicesTable";

export default async function ServicesPage() {
  await requireAdmin();

  const [students, groups, invoices, paidAgg, pendingAgg] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT" },
      select: { id: true, name: true, group: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.group.findMany({ orderBy: { name: "asc" } }),
    prisma.invoice.findMany({
      include: {
        student: { select: { name: true, group: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.invoice.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: { status: "PENDING" },
      _sum: { amount: true },
    }),
  ]);

  const studentOpts = students.map((s) => ({
    id: s.id,
    name: s.name,
    group: s.group?.name ?? null,
  }));
  const collected = Number(paidAgg._sum.amount ?? 0);
  const pending = Number(pendingAgg._sum.amount ?? 0);

  const invoiceRows = invoices.map((inv) => ({
    id: inv.id,
    description: inv.description,
    amount: Number(inv.amount),
    dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
    status: inv.status,
    studentName: inv.student.name,
    groupName: inv.student.group?.name ?? null,
  }));

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Servicios y cobros</h1>
        <p className="text-sm text-ink/50">
          Creá cobros (alquileres, servicios) y controlá los pagos.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Card className="p-4">
          <div className="mb-1 flex items-center gap-2 text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs text-ink/50">Cobrado</span>
          </div>
          <p className="text-xl font-bold text-emerald-300">
            {formatMoney(collected)}
          </p>
        </Card>
        <Card className="p-4">
          <div className="mb-1 flex items-center gap-2 text-amber-300">
            <Clock className="h-4 w-4" />
            <span className="text-xs text-ink/50">Por cobrar</span>
          </div>
          <p className="text-xl font-bold text-amber-300">
            {formatMoney(pending)}
          </p>
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Receipt className="h-5 w-5 text-accent" />
          <CardTitle className="text-ink/80">Nuevo cobro</CardTitle>
        </div>
        <CreateInvoiceForm students={studentOpts} groups={groups} />
      </Card>

      <InvoicesTable invoices={invoiceRows} />
    </div>
  );
}
