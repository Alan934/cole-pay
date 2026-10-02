import { ClipboardCheck, Landmark, Star } from "lucide-react";
import { requireStudent } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getStudentBanks } from "@/lib/memberships";
import { formatDate } from "@/lib/utils";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function MyBanksPage() {
  const me = await requireStudent();

  const [mine, activeBanks] = await Promise.all([
    getStudentBanks(me.id),
    prisma.bank.findMany({
      where: { active: true },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const mineIds = new Set(mine.map((b) => b.bankId));
  const others = activeBanks.filter((b) => !mineIds.has(b.id));

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Mis bancos</h1>
        <p className="text-sm text-ink/50">
          Sólo podés operar con los bancos a los que estás adherido.
        </p>
      </div>

      {mine.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-warning/15 text-warning">
            <Landmark className="h-7 w-7" />
          </div>
          <div>
            <CardTitle className="text-base text-ink">
              Todavía no sos cliente de ningún banco
            </CardTitle>
            <p className="mt-1 text-sm text-ink/55">
              Sin un banco no podés pedir tarjeta, préstamo ni hacer un plazo
              fijo, ni librar cheques.
            </p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {mine.map((b) => (
            <Card key={b.bankId} className="flex items-center gap-3">
              <span
                className="h-10 w-10 shrink-0 rounded-xl"
                style={{ backgroundColor: b.color }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {b.name}
                  {b.isPrimary && (
                    <Badge tone="accent" className="gap-1">
                      <Star className="h-3 w-3" />
                      Principal
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-ink/45">
                  Cliente desde {formatDate(b.adheredAt)}
                </p>
              </div>
            </Card>
          ))}
          <p className="px-1 text-xs text-ink/40">
            Tu banco principal es el primero al que te adheriste.
          </p>
        </div>
      )}

      <Card>
        <div className="mb-1 flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-accent" />
          <CardTitle>Cómo adherirte a un banco</CardTitle>
        </div>
        <p className="text-sm text-ink/55">
          El trámite se hace en persona: pasá por el mostrador del banco y los
          chicos de quinto te dan de alta en el sistema. Podés adherirte a más
          de un banco.
        </p>
      </Card>

      {others.length > 0 && (
        <Card>
          <CardTitle className="mb-3">
            {mine.length === 0 ? "Bancos de la cursada" : "Otros bancos"}
          </CardTitle>
          <ul className="flex flex-col gap-2">
            {others.map((b) => (
              <li key={b.id} className="flex items-center gap-3 text-sm">
                <span
                  className="h-6 w-6 shrink-0 rounded-lg"
                  style={{ backgroundColor: b.color }}
                  aria-hidden
                />
                {b.name}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
