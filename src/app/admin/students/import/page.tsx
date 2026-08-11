import { ArrowLeft } from "lucide-react";
import { NavLink } from "@/components/NavProgress";
import { requireAdminSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ImportStudentsForm } from "./ImportStudentsForm";

export default async function ImportStudentsPage() {
  await requireAdminSession();

  const groups = await prisma.group.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <NavLink
          href="/admin/students"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-ink/50 hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Alumnos
        </NavLink>
        <h1 className="text-2xl font-bold">Importar alumnos</h1>
        <p className="text-sm text-ink/50">
          Subí la lista del curso en Excel y creá todas las cuentas de una vez.
        </p>
      </div>

      <ImportStudentsForm
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
      />
    </div>
  );
}
