"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Search, Star, UserPlus } from "lucide-react";
import { adhereStudent, endMembership } from "@/app/actions/memberships";
import type { ActionResult } from "@/app/actions/student";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

export type ClientView = {
  membershipId: string;
  name: string;
  group: string | null;
  adheredAt: string;
  /** Este banco es el primero al que se adhirió: su banco principal. */
  isPrimary: boolean;
  registeredBy: string | null;
  note: string | null;
};

export type CandidateOption = { id: string; name: string; group: string | null };

function Feedback({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <p className={state.ok ? "text-sm text-accent" : "text-sm text-danger"}>
      {state.ok ? state.message : state.error}
    </p>
  );
}

function SubmitBtn({
  label,
  variant,
  size = "md",
}: {
  label: string;
  variant?: "primary" | "outline" | "danger";
  size?: "sm" | "md";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size={size} variant={variant} disabled={pending}>
      {pending ? "..." : label}
    </Button>
  );
}

export function ClientsDesk({
  clients,
  candidates,
  bankName,
}: {
  clients: ClientView[];
  candidates: CandidateOption[];
  bankName: string;
}) {
  const [query, setQuery] = useState("");
  // El estado de la baja vive acá y no en cada fila: al darse de baja la fila
  // desaparece de la lista, y con ella se perdería el mensaje.
  const [endState, endAction] = useActionState<ActionResult | null, FormData>(
    endMembership,
    null,
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.group ?? "").toLowerCase().includes(q),
    );
  }, [clients, query]);

  return (
    <div className="flex flex-col gap-6">
      <AdhereForm candidates={candidates} bankName={bankName} />

      <section className="flex flex-col gap-3">
        <CardTitle className="px-1">
          Clientes de {bankName} ({clients.length})
        </CardTitle>

        <Feedback state={endState} />

        {clients.length > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o curso"
              className="pl-10"
              aria-label="Buscar cliente"
            />
          </div>
        )}

        {clients.length === 0 ? (
          <Card className="py-8 text-center text-sm text-ink/40">
            Todavía no hay clientes adheridos. Cuando un alumno se presente en el
            mostrador, cargalo acá arriba.
          </Card>
        ) : visible.length === 0 ? (
          <Card className="py-8 text-center text-sm text-ink/40">
            Ningún cliente coincide con la búsqueda.
          </Card>
        ) : (
          <Card className="divide-y divide-raised p-0">
            {visible.map((c) => (
              <ClientRow key={c.membershipId} c={c} endAction={endAction} />
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

/** Alta de un cliente que se presentó en el mostrador. */
function AdhereForm({
  candidates,
  bankName,
}: {
  candidates: CandidateOption[];
  bankName: string;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    adhereStudent,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
    }
  }, [state]);

  const options = useMemo(
    () =>
      candidates.map((s) => ({ value: s.id, label: s.name, hint: s.group })),
    [candidates],
  );

  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-accent" />
        <CardTitle className="text-ink/80">Adherir un cliente</CardTitle>
      </div>
      <p className="mb-4 text-sm text-ink/50">
        Cuando el alumno se presenta en el mostrador y se hace el trámite en
        persona, lo das de alta en {bankName}. Después puede pedirte tarjeta, préstamo, plazo fijo y operar
        por la ventanilla.
      </p>

      <form ref={ref} action={formAction} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="adhere-student">Alumno</Label>
          <SearchSelect
            id="adhere-student"
            name="studentId"
            options={options}
            required
            placeholder="Elegí al alumno…"
            searchPlaceholder="Buscar por nombre o curso…"
            emptyMessage="No hay alumnos para adherir."
          />
        </div>

        <div>
          <Label htmlFor="adhere-note">Observaciones (opcional)</Label>
          <Input
            id="adhere-note"
            name="note"
            placeholder="Ej: lo atendió en el recreo"
            maxLength={200}
          />
        </div>

        <Feedback state={state} />
        <div className="flex items-center gap-3">
          <SubmitBtn label="Adherir al banco" />
        </div>
      </form>
    </Card>
  );
}

function ClientRow({
  c,
  endAction,
}: {
  c: ClientView;
  endAction: (formData: FormData) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="truncate">{c.name}</span>
            {c.group && (
              <span className="text-xs font-normal text-ink/40">{c.group}</span>
            )}
            {c.isPrimary && (
              <Badge tone="accent" className="gap-1">
                <Star className="h-3 w-3" />
                Banco principal
              </Badge>
            )}
          </p>
          <p className="mt-0.5 text-xs text-ink/45">
            Cliente desde {formatDate(c.adheredAt)}
            {c.registeredBy ? ` · lo adhirió ${c.registeredBy}` : ""}
          </p>
          {c.note && <p className="mt-0.5 text-xs text-ink/40">{c.note}</p>}
        </div>

        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="shrink-0 text-xs text-ink/45 transition-colors hover:text-danger"
          >
            Dar de baja
          </button>
        )}
      </div>

      {confirming && (
        <form action={endAction} className="mt-2 flex items-center gap-2">
          <input type="hidden" name="membershipId" value={c.membershipId} />
          <span className="text-xs text-ink/55">
            ¿Seguro? Va a dejar de ser cliente del banco.
          </span>
          <SubmitBtn label="Sí, dar de baja" variant="danger" size="sm" />
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-xs text-ink/50 hover:text-ink"
          >
            Cancelar
          </button>
        </form>
      )}
    </div>
  );
}
