import { Landmark, PiggyBank, CalendarClock } from "lucide-react";
import { requireBankStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { simpleInterest } from "@/lib/interest";
import { RateBoard } from "@/components/bank/RateBoard";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BankDepositsPage() {
  const me = await requireBankStaff();
  const bank = me.bank;
  if (!bank) return null;

  const [terms, active, settled] = await Promise.all([
    prisma.depositTerm.findMany({
      where: { bankId: bank.id },
      orderBy: { days: "asc" },
    }),
    prisma.fixedDeposit.findMany({
      where: { bankId: bank.id, status: "ACTIVE" },
      include: { user: { select: { name: true, group: { select: { name: true } } } } },
      orderBy: { maturesAt: "asc" },
    }),
    prisma.fixedDeposit.findMany({
      where: { bankId: bank.id, status: { in: ["WITHDRAWN", "BROKEN"] } },
      include: { user: { select: { name: true } } },
      orderBy: { withdrawnAt: "desc" },
      take: 15,
    }),
  ]);

  // Cuántos depósitos vivos tiene cada plazo de la pizarra.
  const takenByDays = new Map<number, number>();
  for (const d of active)
    takenByDays.set(d.termDays, (takenByDays.get(d.termDays) ?? 0) + 1);

  const now = new Date();
  const rows = active.map((d) => {
    const principal = Number(d.principal);
    const tnaPct = Number(d.ratePct);
    const interest = simpleInterest(principal, tnaPct, d.termDays);
    return {
      id: d.id,
      name: d.user.name,
      group: d.user.group?.name ?? null,
      principal,
      tnaPct,
      termDays: d.termDays,
      interest,
      payout: principal + interest,
      maturesAt: d.maturesAt,
      matured: d.maturesAt <= now,
    };
  });

  const taken = rows.reduce((acc, r) => acc + r.principal, 0);
  const owed = rows.reduce((acc, r) => acc + r.payout, 0);
  const maturedCount = rows.filter((r) => r.matured).length;
  const bankBalance = Number(bank.account.wallet?.balance ?? 0);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Plazos fijos</h1>
        <p className="text-sm text-ink/50">
          La plata que te dejaron a plazo entra a tu caja y la podés prestar.
          Pero al vencimiento tenés que devolverla con el interés pactado.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={PiggyBank}
          label="Tomado a plazo"
          value={formatMoney(taken)}
          tone="text-violet"
        />
        <Stat
          icon={Landmark}
          label="Vas a tener que pagar"
          value={formatMoney(owed)}
          tone="text-ink"
        />
        <Stat
          icon={CalendarClock}
          label="Vencidos sin cobrar"
          value={maturedCount.toString()}
          tone={maturedCount > 0 ? "text-warning" : "text-ink"}
        />
        <Stat
          icon={Landmark}
          label="Caja disponible"
          value={formatMoney(bankBalance)}
          tone={bankBalance < owed ? "text-danger" : "text-accent"}
        />
      </div>

      {owed > bankBalance && (
        <Card className="border-warning/40 bg-warning/5">
          <CardTitle className="text-ink/80">
            Debés más de lo que tenés en caja
          </CardTitle>
          <p className="mt-1 text-sm text-ink/55">
            Al vencimiento hay que pagar {formatMoney(owed)} y en la caja tenés{" "}
            {formatMoney(bankBalance)}. Vas a necesitar que te paguen los
            resúmenes y las cuotas antes de esa fecha, o tomar más depósitos.
          </p>
        </Card>
      )}

      <RateBoard
        loanRatePct={Number(bank.loanRatePct)}
        terms={terms.map((t) => ({
          id: t.id,
          days: t.days,
          tnaPct: Number(t.tnaPct),
          active: t.active,
          takenCount: takenByDays.get(t.days) ?? 0,
        }))}
      />

      <Card>
        <CardTitle className="mb-3">Depósitos vigentes</CardTitle>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/40">
            Nadie te dejó plata a plazo fijo todavía. Publicá una tasa que
            convenga y esperá clientes.
          </p>
        ) : (
          <div className="divide-y divide-raised">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {r.name}
                    {r.group ? (
                      <span className="text-ink/40"> ({r.group})</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-ink/40">
                    {formatMoney(r.principal)} · {r.tnaPct}% TNA · {r.termDays}{" "}
                    días · vence {formatDate(r.maturesAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold text-violet">
                    {formatMoney(r.payout)}
                  </span>
                  {r.matured && <Badge tone="warning">Vencido</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {settled.length > 0 && (
        <Card>
          <CardTitle className="mb-3">Ya devueltos</CardTitle>
          <div className="divide-y divide-raised">
            {settled.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-ink/85">{d.user.name}</p>
                  <p className="text-xs text-ink/40">
                    {d.status === "BROKEN"
                      ? "Lo rompió antes de tiempo"
                      : "Cobrado al vencimiento"}
                    {d.withdrawnAt ? ` · ${formatDate(d.withdrawnAt)}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-ink/70">
                  {formatMoney(Number(d.payoutAmount ?? d.principal))}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Landmark;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${tone}`} />
        <span className="text-xs text-ink/50">{label}</span>
      </div>
      <p className={`text-xl font-bold ${tone}`}>{value}</p>
    </Card>
  );
}
