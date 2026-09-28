"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Search, UserMinus, UserPlus } from "lucide-react";
import { assignEmployees, removeEmployee } from "@/app/actions/banks";
import type { ActionResult } from "@/app/actions/student";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { useFuzzyList } from "@/lib/fuzzy";
import { cn } from "@/lib/utils";

export type EmployeeOption = {
  id: string;
  name: string;
  email: string;
  /** Banco actual, cuando se lo está por mover de un banco a otro. */
  currentBank: string | null;
};

const SEARCH_KEYS = ["name", "email", "currentBank"];

/**
 * Equipo del banco. Los alumnos se pueden sumar de a uno o marcando varios y
 * asignándolos de una sola vez.
 */
export function EmployeesPanel({
  bankId,
  employees,
  available,
}: {
  bankId: string;
  employees: EmployeeOption[];
  available: EmployeeOption[];
}) {
  const [assignState, assignAction] = useActionState<
    ActionResult | null,
    FormData
  >(assignEmployees, null);
  const [removeState, removeAction] = useActionState<
    ActionResult | null,
    FormData
  >(removeEmployee, null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  // Con todo quinto en la lista se vuelve incómoda: se busca por nombre,
  // email o banco actual. Lo ya tildado viaja en los inputs ocultos del
  // formulario, así que filtrar no pierde la selección.
  const visible = useFuzzyList(available, SEARCH_KEYS, query);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-sm font-medium text-ink/70">
          En el mostrador ({employees.length})
        </p>
        {employees.length === 0 ? (
          <p className="rounded-xl border border-dashed border-raised3 px-3 py-6 text-center text-sm text-ink/40">
            Este banco todavía no tiene equipo.
          </p>
        ) : (
          <ul className="divide-y divide-raised">
            {employees.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  <p className="truncate text-xs text-ink/40">{e.email}</p>
                </div>
                <form action={removeAction}>
                  <input type="hidden" name="userId" value={e.id} />
                  <RemoveButton />
                </form>
              </li>
            ))}
          </ul>
        )}
        {removeState && !removeState.ok && (
          <div className="mt-2">
            <FormFeedback ok={false} msg={removeState.error} />
          </div>
        )}
      </div>

      <form action={assignAction} className="flex flex-col gap-3">
        <input type="hidden" name="bankId" value={bankId} />
        {selected.map((id) => (
          <input key={id} type="hidden" name="userIds" value={id} />
        ))}

        <p className="text-sm font-medium text-ink/70">
          Sumar alumnos de quinto
        </p>

        {available.length === 0 ? (
          <p className="rounded-xl border border-dashed border-raised3 px-3 py-6 text-center text-sm text-ink/40">
            No hay más alumnos de quinto para asignar. Creá uno desde la lista
            de bancos.
          </p>
        ) : (
          <>
            {available.length > 6 && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
                <Input
                  value={query}
                  onChange={(ev) => setQuery(ev.target.value)}
                  placeholder="Buscar alumno de quinto…"
                  className="pl-10"
                />
              </div>
            )}

            <div className="max-h-64 overflow-y-auto rounded-xl border border-raised2">
              {visible.length === 0 && (
                <p className="p-3 text-sm text-ink/40">
                  No se encontró ningún alumno.
                </p>
              )}
              {visible.map((e) => {
                const checked = selected.includes(e.id);
                return (
                  <label
                    key={e.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 border-b border-raised2/60 px-3 py-2 text-sm last:border-b-0 transition-colors",
                      checked ? "bg-accent/10" : "hover:bg-raised/60",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(e.id)}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {e.name}
                      </span>
                      <span className="block truncate text-xs text-ink/40">
                        {e.currentBank
                          ? `Hoy está en ${e.currentBank}`
                          : "Sin banco"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {assignState && (
              <FormFeedback
                ok={assignState.ok}
                msg={assignState.ok ? assignState.message : assignState.error}
              />
            )}

            <AssignButton count={selected.length} />
          </>
        )}
      </form>
    </div>
  );
}

function AssignButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || count === 0}>
      <UserPlus className="h-4 w-4" />
      {pending
        ? "Asignando..."
        : count === 0
          ? "Elegí al menos un alumno"
          : `Asignar ${count} ${count === 1 ? "alumno" : "alumnos"}`}
    </Button>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label="Quitar del banco"
    >
      <UserMinus className="h-4 w-4" />
      {pending ? "Quitando..." : "Quitar"}
    </Button>
  );
}
