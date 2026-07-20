import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { StudentsManager } from "./StudentsManager";

export default async function StudentsPage() {
  await requireAdmin();

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
    role: s.role,
    balance: Number(s.wallet?.balance ?? 0),
    alias: s.wallet?.alias ?? "—",
    groupId: s.groupId,
    groupName: s.group?.name ?? null,
  }));
  const groupOpts = groups.map((g) => ({ id: g.id, name: g.name }));

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Alumnos</h1>
        <p className="text-sm text-ink/50">
          Creá y administrá las cuentas de tus alumnos.
        </p>
      </div>
      <StudentsManager students={rows} groups={groupOpts} />
    </div>
  );
}
