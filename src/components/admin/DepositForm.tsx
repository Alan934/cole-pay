"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Wallet } from "lucide-react";
import { depositToStudent } from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/student";
import { Input, Label, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormFeedback } from "./FormFeedback";

type StudentOption = { id: string; name: string; group: string | null };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <Wallet className="h-4 w-4" />
      {pending ? "Cargando..." : "Cargar saldo"}
    </Button>
  );
}

export function DepositForm({ students }: { students: StudentOption[] }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    depositToStudent,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-3">
      <div>
        <Label htmlFor="dep-student">Alumno</Label>
        <Select id="dep-student" name="studentId" required defaultValue="">
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
          <Label htmlFor="dep-amount">Monto</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40">
              $
            </span>
            <Input
              id="dep-amount"
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
          <Label htmlFor="dep-desc">Concepto (opcional)</Label>
          <Input id="dep-desc" name="description" placeholder="Efectivo" />
        </div>
      </div>
      {state && (
        <FormFeedback ok={state.ok} msg={state.ok ? state.message : state.error} />
      )}
      <Submit />
    </form>
  );
}
