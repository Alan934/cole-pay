import { FileSpreadsheet } from "lucide-react";
import { NavLink } from "@/components/NavProgress";
import { requireAdminAreaSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { StudentsManager } from "./StudentsManager";
import { BankStudentsManager } from "./BankStudentsManager";

export default async function StudentsPage({
  searchParams,
}: {
  // `?grupo=<id>` llega desde las tarjetas de /admin/groups.
  searchParams: Promise<{ grupo?: string }>;
}) {
  // Cada profe administra su propio curso. La de tercero, los clientes del
  // banco; la de quinto, los alumnos que atienden el mostrador: no se ven
  // entre ellos ni se pisan las cuentas.
  const me = await requireAdminAreaSession();
  if (me.role === "BANK_ADMIN") return <FifthYearStudents />;

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
        canCreateStaff
      />
    </div>
  );
}

/**
 * Lo que ve la profe de quinto: sus alumnos, los que atienden los bancos.
 * No llevan billetera, así que en vez de saldo y curso la lista muestra el
 * banco donde trabaja cada uno.
 */
async function FifthYearStudents() {
  const [students, banks] = await Promise.all([
    prisma.user.findMany({
      where: { role: "BANK_EMPLOYEE" },
      include: { bank: { select: { id: true, name: true, color: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.bank.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, active: true },
    }),
  ]);

  const rows = students.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    dni: s.dni,
    cuit: s.cuit,
    bankId: s.bankId,
    bankName: s.bank?.name ?? null,
    bankColor: s.bank?.color ?? null,
  }));

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Alumnos de quinto</h1>
          <p className="text-sm text-ink/50">
            Creá las cuentas de tus alumnos y asigná a cada uno el banco que va
            a atender.
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
      <BankStudentsManager students={rows} banks={banks} />
    </div>
  );
}
