import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatCuit, formatDni } from "@/lib/identity";
import { buildCsv } from "@/lib/csv";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return new Response("No autorizado", { status: 403 });
  }

  const invoices = await prisma.invoice.findMany({
    where: { status: "PENDING" },
    include: {
      student: {
        select: {
          name: true,
          email: true,
          dni: true,
          cuit: true,
          group: { select: { name: true } },
        },
      },
    },
    orderBy: [{ student: { name: "asc" } }, { createdAt: "asc" }],
  });

  const header = [
    "Alumno",
    "DNI",
    "CUIT",
    "Email",
    "Grupo",
    "Concepto",
    "Monto",
    "Vencimiento",
  ];
  const rows = invoices.map((i) => [
    i.student.name,
    i.student.dni ? formatDni(i.student.dni) : "",
    i.student.cuit ? formatCuit(i.student.cuit) : "",
    i.student.email,
    i.student.group?.name ?? "",
    i.description,
    i.amount.toString(),
    i.dueDate ? i.dueDate.toISOString().slice(0, 10) : "",
  ]);

  const csv = buildCsv(header, rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="colepay-deudores.csv"`,
    },
  });
}
