import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return new Response("No autorizado", { status: 403 });
  }

  const invoices = await prisma.invoice.findMany({
    where: { status: "PENDING" },
    include: {
      student: { select: { name: true, email: true, group: { select: { name: true } } } },
    },
    orderBy: [{ student: { name: "asc" } }, { createdAt: "asc" }],
  });

  const header = ["Alumno", "Email", "Grupo", "Concepto", "Monto", "Vencimiento"];
  const rows = invoices.map((i) =>
    [
      i.student.name,
      i.student.email,
      i.student.group?.name ?? "",
      i.description,
      i.amount.toString(),
      i.dueDate ? i.dueDate.toISOString().slice(0, 10) : "",
    ]
      .map((v) => csvEscape(String(v)))
      .join(","),
  );

  const csv = "﻿" + [header.join(","), ...rows].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="colepay-deudores.csv"`,
    },
  });
}
