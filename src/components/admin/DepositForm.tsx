"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Wallet } from "lucide-react";
import { depositToStudent } from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/student";
import { Input, Label } from "@/components/ui/Input";
import { SearchSelect } from "@/components/ui/SearchSelect";
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

  const options = useMemo(
    () => students.map((s) => ({ value: s.id, label: s.name, hint: s.group })),
    [students],
  );

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-3">
      <div>
        <Label htmlFor="dep-student">Alumno</Label>
        <SearchSelect
          id="dep-student"
          name="studentId"
          options={options}
          required
          placeholder="Seleccioná un alumno…"
          searchPlaceholder="Buscar por nombre o grupo…"
          emptyMessage="No se encontró ningún alumno."
        />
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
