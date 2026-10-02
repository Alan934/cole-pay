import { requireBankStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ACTIVE_MEMBERSHIP } from "@/lib/memberships";
import { ClientsDesk } from "@/components/bank/ClientsDesk";

export const dynamic = "force-dynamic";

export default async function BankClientsPage() {
  const me = await requireBankStaff();
  const bank = me.bank;
  if (!bank) return null;

  const [memberships, candidates] = await Promise.all([
    prisma.bankMembership.findMany({
      where: { bankId: bank.id, ...ACTIVE_MEMBERSHIP },
      include: {
        student: {
          select: {
            name: true,
            group: { select: { name: true } },
            // Su adhesión vigente más antigua es la del banco principal.
            memberships: {
              where: ACTIVE_MEMBERSHIP,
              orderBy: { adheredAt: "asc" },
              take: 1,
              select: { bankId: true },
            },
          },
        },
        registeredBy: { select: { name: true } },
      },
      orderBy: { adheredAt: "desc" },
    }),
    // Para adherir se busca entre todos los alumnos que todavía no son
    // clientes de este banco. No se muestra nada de su cuenta.
    prisma.user.findMany({
      where: {
        role: "STUDENT",
        memberships: { none: { bankId: bank.id, ...ACTIVE_MEMBERSHIP } },
      },
      select: { id: true, name: true, group: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-sm text-ink/50">
          Sólo los alumnos adheridos a {bank.name} pueden pedirte tarjeta,
          préstamo o plazo fijo, y operar por tu ventanilla.
        </p>
      </div>

      <ClientsDesk
        bankName={bank.name}
        clients={memberships.map((m) => ({
          membershipId: m.id,
          name: m.student.name,
          group: m.student.group?.name ?? null,
          adheredAt: m.adheredAt.toISOString(),
          isPrimary: m.student.memberships[0]?.bankId === bank.id,
          registeredBy: m.registeredBy?.name ?? null,
          note: m.note,
        }))}
        candidates={candidates.map((s) => ({
          id: s.id,
          name: s.name,
          group: s.group?.name ?? null,
        }))}
      />
    </div>
  );
}
