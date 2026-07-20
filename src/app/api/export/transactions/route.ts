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

  const txs = await prisma.transaction.findMany({
    include: { sender: true, receiver: true },
    orderBy: { timestamp: "desc" },
  });

  const header = [
    "Fecha",
    "Tipo",
    "De",
    "Para",
    "Categoria",
    "Descripcion",
    "Monto",
  ];
  const rows = txs.map((t) =>
    [
      t.timestamp.toISOString(),
      t.type,
      t.sender?.name ?? "Banco Central",
      t.receiver?.name ?? "Sistema",
      t.category ?? "",
      t.description,
      t.amount.toString(),
    ]
      .map((v) => csvEscape(String(v)))
      .join(","),
  );

  // BOM para que Excel reconozca UTF-8.
  const csv = "﻿" + [header.join(","), ...rows].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="colepay-transacciones.csv"`,
    },
  });
}
