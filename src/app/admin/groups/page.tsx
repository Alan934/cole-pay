import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardTitle } from "@/components/ui/Card";
import { CreateGroupForm } from "./CreateGroupForm";
import { GroupsList } from "./GroupsList";

export default async function GroupsPage() {
  await requireAdmin();

  const groups = await prisma.group.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { users: true } },
      users: {
        where: { role: "STUDENT" },
        select: { wallet: { select: { balance: true } } },
      },
    },
  });

  const cards = groups.map((g) => ({
    id: g.id,
    name: g.name,
    members: g._count.users,
    total: g.users.reduce((acc, u) => acc + Number(u.wallet?.balance ?? 0), 0),
  }));

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Grupos</h1>
        <p className="text-sm text-ink/50">
          Organizá a los alumnos por curso o división.
        </p>
      </div>

      <Card>
        <CardTitle className="mb-3">Crear grupo</CardTitle>
        <CreateGroupForm />
      </Card>

      <GroupsList groups={cards} />
    </div>
  );
}
