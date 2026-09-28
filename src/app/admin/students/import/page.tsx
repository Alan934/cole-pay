import { ArrowLeft } from "lucide-react";
import { NavLink } from "@/components/NavProgress";
import { requireAdminAreaSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ImportStudentsForm } from "./ImportStudentsForm";

export default async function ImportStudentsPage() {
  const me = await requireAdminAreaSession();
  // La profe de quinto importa a sus alumnos dentro de un banco; la de
  // tercero, dentro de un curso.
  const isBankAdmin = me.role === "BANK_ADMIN";

  const targets = isBankAdmin
    ? await prisma.bank.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : await prisma.group.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });

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
          {isBankAdmin
            ? "Subí la lista de quinto en Excel y creá todas las cuentas del banco de una vez."
            : "Subí la lista del curso en Excel y creá todas las cuentas de una vez."}
        </p>
      </div>

      <ImportStudentsForm
        targets={targets}
        scope={isBankAdmin ? "bank" : "group"}
      />
    </div>
  );
}
