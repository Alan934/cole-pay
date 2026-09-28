"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cancelApplication } from "@/app/actions/cards";
import type { ActionResult } from "@/app/actions/student";
import { Card, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { formatDate, formatMoney } from "@/lib/utils";

export type ApplicationView = {
  id: string;
  bankName: string;
  color: string;
  status: string;
  requestedLimit: number;
  purpose: string | null;
  reviewNote: string | null;
  createdAt: string;
};

const STATUS: Record<
  string,
  { label: string; tone: "warning" | "success" | "danger" | "neutral" }
> = {
  PENDING: { label: "Esperando respuesta", tone: "warning" },
  APPROVED: { label: "Aprobada", tone: "success" },
  REJECTED: { label: "Rechazada", tone: "danger" },
  CANCELLED: { label: "Dada de baja", tone: "neutral" },
};

export function ApplicationsList({
  applications,
}: {
  applications: ApplicationView[];
}) {
  if (applications.length === 0) return null;

  return (
    <Card>
      <CardTitle className="mb-3">Mis solicitudes</CardTitle>
      <div className="flex flex-col gap-2">
        {applications.map((a) => (
          <ApplicationRow key={a.id} application={a} />
        ))}
      </div>
    </Card>
  );
}

function ApplicationRow({ application }: { application: ApplicationView }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    cancelApplication,
    null,
  );
  const badge = STATUS[application.status] ?? {
    label: application.status,
    tone: "neutral" as const,
  };

  return (
    <div className="rounded-xl border border-raised2/70 bg-raised/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-8 w-8 shrink-0 rounded-lg"
            style={{ backgroundColor: application.color }}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {application.bankName}
            </p>
            <p className="text-xs text-ink/45">
              {formatMoney(application.requestedLimit)} ·{" "}
              {formatDate(application.createdAt)}
            </p>
          </div>
        </div>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>

      {application.reviewNote && (
        <p className="mt-2 rounded-lg bg-raised2/50 px-3 py-2 text-xs text-ink/60">
          <span className="font-medium text-ink/75">Respuesta del banco: </span>
          {application.reviewNote}
        </p>
      )}

      {application.status === "PENDING" && (
        <form action={formAction} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="applicationId" value={application.id} />
          <CancelButton />
          {state && !state.ok && <FormFeedback ok={false} msg={state.error} />}
        </form>
      )}
    </div>
  );
}

function CancelButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="sm" disabled={pending}>
      {pending ? "Dando de baja..." : "Dar de baja la solicitud"}
    </Button>
  );
}
