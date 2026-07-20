"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Receipt } from "lucide-react";
import { createInvoices } from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/student";
import { Input, Label, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormFeedback } from "@/components/admin/FormFeedback";

type StudentOpt = { id: string; name: string; group: string | null };
type GroupOpt = { id: string; name: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Receipt className="h-4 w-4" />
      {pending ? "Creando..." : "Crear cobro"}
    </Button>
  );
}

export function CreateInvoiceForm({
  students,
  groups,
}: {
  students: StudentOpt[];
  groups: GroupOpt[];
}) {
  const [mode, setMode] = useState<"group" | "students">("group");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    createInvoices,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="i-desc">Concepto</Label>
          <Input
            id="i-desc"
            name="description"
            placeholder="ej: Alquiler Stand A - Semana 2"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="i-amount">Monto</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40">
                $
              </span>
              <Input
                id="i-amount"
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
            <Label htmlFor="i-due">Vencimiento</Label>
            <Input id="i-due" name="dueDate" type="date" />
          </div>
        </div>
      </div>

      {/* Modo de asignación */}
      <div>
        <Label>Asignar a</Label>
        <div className="mb-3 flex gap-2">
          <ModeButton
            active={mode === "group"}
            onClick={() => setMode("group")}
            label="Un grupo entero"
          />
          <ModeButton
            active={mode === "students"}
            onClick={() => setMode("students")}
            label="Alumnos específicos"
          />
        </div>

        {mode === "group" ? (
          <Select name="groupId" defaultValue="" required>
            <option value="" disabled>
              Seleccioná un grupo…
            </option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        ) : (
          <div className="max-h-56 overflow-y-auto rounded-xl border border-raised2 bg-panel/60 p-2">
            {students.length === 0 ? (
              <p className="p-3 text-sm text-ink/40">No hay alumnos.</p>
            ) : (
              students.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-raised"
                >
                  <input
                    type="checkbox"
                    name="studentIds"
                    value={s.id}
                    className="h-4 w-4 accent-[#00e5a0]"
                  />
                  <span className="text-sm">
                    {s.name}
                    {s.group && (
                      <span className="ml-2 text-xs text-ink/40">
                        {s.group}
                      </span>
                    )}
                  </span>
                </label>
              ))
            )}
          </div>
        )}
      </div>

      {state && (
        <FormFeedback ok={state.ok} msg={state.ok ? state.message : state.error} />
      )}
      <div className="flex justify-end">
        <Submit />
      </div>
    </form>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-xl bg-accent px-4 py-2 text-sm font-medium text-onaccent"
          : "rounded-xl border border-raised2 px-4 py-2 text-sm text-ink/70 hover:bg-raised"
      }
    >
      {label}
    </button>
  );
}
