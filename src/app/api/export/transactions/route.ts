import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatCuit, formatDni } from "@/lib/identity";
import { buildCsv } from "@/lib/csv";

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
    "De DNI",
    "De CUIT",
    "Para",
    "Para DNI",
    "Para CUIT",
    "Categoria",
    "Descripcion",
    "Monto",
  ];
  const rows = txs.map((t) => [
    t.timestamp.toISOString(),
    t.type,
    t.sender?.name ?? "Banco Central",
    t.sender?.dni ? formatDni(t.sender.dni) : "",
    t.sender?.cuit ? formatCuit(t.sender.cuit) : "",
    t.receiver?.name ?? "Sistema",
    t.receiver?.dni ? formatDni(t.receiver.dni) : "",
    t.receiver?.cuit ? formatCuit(t.receiver.cuit) : "",
    t.category ?? "",
    t.description,
    t.amount.toString(),
  ]);

  const csv = buildCsv(header, rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="colepay-transacciones.csv"`,
    },
  });
}
