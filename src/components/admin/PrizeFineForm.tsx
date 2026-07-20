"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Gift, Ban } from "lucide-react";
import { prizeOrFine } from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/student";
import { Input, Label, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormFeedback } from "./FormFeedback";

type StudentOption = { id: string; name: string; group: string | null };

function Submit({ kind }: { kind: "PRIZE" | "FINE" }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={kind === "FINE" ? "danger" : "primary"}
      disabled={pending}
    >
      {kind === "PRIZE" ? <Gift className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
      {pending ? "Aplicando..." : kind === "PRIZE" ? "Premiar" : "Multar"}
    </Button>
  );
}

export function PrizeFineForm({ students }: { students: StudentOption[] }) {
  const [kind, setKind] = useState<"PRIZE" | "FINE">("PRIZE");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    prizeOrFine,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="kind" value={kind} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setKind("PRIZE")}
          className={
            kind === "PRIZE"
              ? "flex-1 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-onaccent"
              : "flex-1 rounded-xl border border-raised2 px-3 py-2 text-sm text-ink/70 hover:bg-raised"
          }
        >
          🎁 Premio
        </button>
        <button
          type="button"
          onClick={() => setKind("FINE")}
          className={
            kind === "FINE"
              ? "flex-1 rounded-xl bg-red-500 px-3 py-2 text-sm font-medium text-white"
              : "flex-1 rounded-xl border border-raised2 px-3 py-2 text-sm text-ink/70 hover:bg-raised"
          }
        >
          ⚠️ Multa
        </button>
      </div>

      <div>
        <Label htmlFor="pf-student">Alumno</Label>
        <Select id="pf-student" name="studentId" required defaultValue="">
          <option value="" disabled>
            Seleccioná un alumno…
          </option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.group ? ` (${s.group})` : ""}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="pf-amount">Monto</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40">
              $
            </span>
            <Input
              id="pf-amount"
              name="amount"
              type="number"
              min="1"
              step="0.01"
              placeholder="0,00"
              className="pl-7"
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="pf-reason">Motivo</Label>
          <Input id="pf-reason" name="reason" placeholder="ej: Buen trabajo" required />
        </div>
      </div>

      {state && (
        <FormFeedback ok={state.ok} msg={state.ok ? state.message : state.error} />
      )}
      <div>
        <Submit kind={kind} />
      </div>
    </form>
  );
}
