"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { formatMoney, formatDate } from "@/lib/utils";
import { InvoiceRowActions } from "./InvoiceRowActions";

export type InvoiceRow = {
  id: string;
  description: string;
  amount: number;
  dueDate: string | null; // ISO o null
  status: string;
  studentName: string;
  groupName: string | null;
};

const STATUS_FILTERS = [
  { value: "ALL", label: "Todas" },
  { value: "PENDING", label: "Pendientes" },
  { value: "PAID", label: "Pagadas" },
  { value: "CANCELLED", label: "Anuladas" },
];

export function InvoicesTable({ invoices }: { invoices: InvoiceRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (status !== "ALL" && inv.status !== status) return false;
      if (!q) return true;
      return `${inv.description} ${inv.studentName} ${inv.groupName ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [invoices, query, status]);

  return (
    <Card className="p-0">
      <div className="flex flex-col gap-3 border-b border-raised px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>Cobros emitidos ({filtered.length})</CardTitle>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar concepto o alumno…"
              className="h-10 pl-9 sm:w-64"
            />
          </div>
          <div className="flex gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatus(f.value)}
                className={
                  status === f.value
                    ? "rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-onaccent"
                    : "rounded-lg border border-raised2 px-3 py-1.5 text-xs text-ink/70 hover:bg-raised"
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink/50">
            <tr className="border-b border-raised">
              <th className="px-5 py-3 font-medium">Concepto</th>
              <th className="px-5 py-3 font-medium">Alumno</th>
              <th className="px-5 py-3 text-right font-medium">Monto</th>
              <th className="px-5 py-3 font-medium">Vence</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-raised">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-ink/40">
                  Sin resultados.
                </td>
              </tr>
            ) : (
              filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-raised/40">
                  <td className="px-5 py-3 text-ink/90">{inv.description}</td>
                  <td className="px-5 py-3">
                    <p className="text-ink/80">{inv.studentName}</p>
                    {inv.groupName && (
                      <p className="text-xs text-ink/40">{inv.groupName}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold">
                    {formatMoney(inv.amount)}
                  </td>
                  <td className="px-5 py-3 text-ink/60">
                    {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    {inv.status === "PAID" ? (
                      <Badge tone="success">Pagada</Badge>
                    ) : inv.status === "CANCELLED" ? (
                      <Badge tone="neutral">Anulada</Badge>
                    ) : (
                      <Badge tone="warning">Pendiente</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {inv.status === "PENDING" && (
                      <InvoiceRowActions
                        invoice={{
                          id: inv.id,
                          description: inv.description,
                          amount: inv.amount,
                          dueDate: inv.dueDate
                            ? inv.dueDate.slice(0, 10)
                            : null,
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
