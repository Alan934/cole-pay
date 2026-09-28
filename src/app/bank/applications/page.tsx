import { Inbox } from "lucide-react";
import { requireBankStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  applicationReviewInclude,
  toApplicationReview,
} from "@/lib/card-views";
import { ApplicationReview } from "@/components/cards/ApplicationReview";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RESOLVED_TONES: Record<
  string,
  { label: string; tone: "success" | "danger" | "neutral" }
> = {
  APPROVED: { label: "Aprobada", tone: "success" },
  REJECTED: { label: "Rechazada", tone: "danger" },
  CANCELLED: { label: "Dada de baja", tone: "neutral" },
};

export default async function BankApplicationsPage() {
  const me = await requireBankStaff();
  const bank = me.bank;
  if (!bank) return null;

  const [pending, resolved] = await Promise.all([
    prisma.cardApplication.findMany({
      where: { bankId: bank.id, status: "PENDING" },
      include: applicationReviewInclude,
      orderBy: { createdAt: "asc" },
    }),
    prisma.cardApplication.findMany({
      where: { bankId: bank.id, status: { not: "PENDING" } },
      include: {
        applicant: { select: { name: true } },
        reviewedBy: { select: { name: true } },
      },
      orderBy: { reviewedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Solicitudes de tarjeta</h1>
        <p className="text-sm text-ink/50">
          Mirá quién pide crédito y decidí cuánto darle. Al aprobar emitís la
          tarjeta en el momento.
        </p>
      </div>

      {pending.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-raised2 text-ink/50">
            <Inbox className="h-7 w-7" />
          </div>
          <div>
            <CardTitle className="text-base text-ink">
              No hay solicitudes esperando
            </CardTitle>
            <p className="mt-1 text-sm text-ink/50">
              Cuando un alumno pida una tarjeta a {bank.name}, va a aparecer
              acá.
            </p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {pending.map((a) => (
            <ApplicationReview
              key={a.id}
              application={toApplicationReview(a)}
            />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <Card>
          <CardTitle className="mb-3">Solicitudes ya resueltas</CardTitle>
          <div className="divide-y divide-raised">
            {resolved.map((a) => {
              const badge = RESOLVED_TONES[a.status] ?? {
                label: a.status,
                tone: "neutral" as const,
              };
              return (
                <div key={a.id} className="py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {a.applicant.name}
                      </p>
                      <p className="truncate text-xs text-ink/40">
                        {formatMoney(Number(a.requestedLimit))} ·{" "}
                        {a.reviewedAt ? formatDate(a.reviewedAt) : "—"}
                        {a.reviewedBy ? ` · ${a.reviewedBy.name}` : ""}
                      </p>
                    </div>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </div>
                  {a.reviewNote && (
                    <p className="mt-1 text-xs text-ink/50">{a.reviewNote}</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
