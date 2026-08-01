"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Receipt, Search } from "lucide-react";
import { createInvoices } from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/student";
import { Input, Label } from "@/components/ui/Input";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { Button } from "@/components/ui/Button";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { useFuzzyList } from "@/lib/fuzzy";

type StudentOpt = { id: string; name: string; group: string | null };
type GroupOpt = { id: string; name: string };

/** Constante a nivel módulo: fuse.js reindexa si cambia la referencia. */
const STUDENT_KEYS = ["name", "group"];

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
  const [studentQuery, setStudentQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    createInvoices,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      setSelectedIds([]);
      setStudentQuery("");
    }
  }, [state]);

  const groupOptions = useMemo(
    () => groups.map((g) => ({ value: g.id, label: g.name })),
    [groups],
  );
  const filteredStudents = useFuzzyList(students, STUDENT_KEYS, studentQuery);

  function toggleStudent(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

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
          <SearchSelect
            name="groupId"
            options={groupOptions}
            required
            placeholder="Seleccioná un grupo…"
            searchPlaceholder="Buscar grupo…"
            emptyMessage="No se encontró ningún grupo."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {/* Los seleccionados viajan por acá para no perderse al filtrar. */}
            {selectedIds.map((id) => (
              <input key={id} type="hidden" name="studentIds" value={id} />
            ))}

            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
              <Input
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="Buscar alumno por nombre o grupo…"
                className="pl-10"
              />
            </div>

            <div className="max-h-56 overflow-y-auto rounded-xl border border-raised2 bg-panel/60 p-2">
              {students.length === 0 ? (
                <p className="p-3 text-sm text-ink/40">No hay alumnos.</p>
              ) : filteredStudents.length === 0 ? (
                <p className="p-3 text-sm text-ink/40">
                  No se encontró ningún alumno.
                </p>
              ) : (
                filteredStudents.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-raised"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(s.id)}
                      onChange={() => toggleStudent(s.id)}
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

            <div className="flex items-center justify-between px-1 text-xs text-ink/40">
              <span>
                {selectedIds.length === 0
                  ? "Ningún alumno seleccionado"
                  : `${selectedIds.length} alumno${selectedIds.length === 1 ? "" : "s"} seleccionado${selectedIds.length === 1 ? "" : "s"}`}
              </span>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="rounded-lg px-2 py-1 text-ink/50 hover:bg-raised2 hover:text-ink"
                >
                  Limpiar selección
                </button>
              )}
            </div>
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
