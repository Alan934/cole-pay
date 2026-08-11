import { FileSpreadsheet } from "lucide-react";
import { NavLink } from "@/components/NavProgress";
import { requireAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { StudentsManager } from "./StudentsManager";

export default async function StudentsPage({
  searchParams,
}: {
  // `?grupo=<id>` llega desde las tarjetas de /admin/groups.
  searchParams: Promise<{ grupo?: string }>;
}) {
  await requireAdminSession();
  const { grupo } = await searchParams;

  const [students, groups] = await Promise.all([
    prisma.user.findMany({
      where: { role: "STUDENT" },
      include: { wallet: true, group: true },
      orderBy: { name: "asc" },
    }),
    prisma.group.findMany({ orderBy: { name: "asc" } }),
  ]);

  const rows = students.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    dni: s.dni,
    cuit: s.cuit,
    role: s.role,
    balance: Number(s.wallet?.balance ?? 0),
    alias: s.wallet?.alias ?? "—",
    groupId: s.groupId,
    groupName: s.group?.name ?? null,
  }));
  const groupOpts = groups.map((g) => ({ id: g.id, name: g.name }));

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Alumnos</h1>
          <p className="text-sm text-ink/50">
            Creá y administrá las cuentas de tus alumnos.
          </p>
        </div>
        <NavLink
          href="/admin/students/import"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-raised2 px-5 text-sm font-medium text-ink transition-colors hover:bg-raised3"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Importar desde Excel
        </NavLink>
      </div>
      <StudentsManager
        students={rows}
        groups={groupOpts}
        initialGroupId={grupo ?? null}
      />
    </div>
  );
}
