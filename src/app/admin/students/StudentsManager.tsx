"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus, Pencil, X, Search } from "lucide-react";
import { createUser, editUser } from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/student";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { useFuzzyList } from "@/lib/fuzzy";
import { formatCuit, formatDni } from "@/lib/identity";
import { formatMoney } from "@/lib/utils";

export type StudentRow = {
  id: string;
  name: string;
  email: string;
  dni: string | null;
  cuit: string | null;
  role: string;
  balance: number;
  alias: string;
  groupId: string | null;
  groupName: string | null;
};
export type GroupOpt = { id: string; name: string };

/** Constante a nivel módulo: fuse.js reindexa si cambia la referencia. */
const STUDENT_KEYS = ["name", "email", "dni", "cuit", "groupName"];

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando..." : label}
    </Button>
  );
}

export function StudentsManager({
  students,
  groups,
}: {
  students: StudentRow[];
  groups: GroupOpt[];
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<StudentRow | null>(null);

  const filtered = useFuzzyList(students, STUDENT_KEYS, query);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <CreateStudentForm groups={groups} />

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, email, DNI, CUIT o grupo…"
            className="pl-9"
          />
        </div>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-raised text-left text-xs text-ink/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Alumno</th>
                  <th className="px-4 py-3 font-medium">DNI / CUIT</th>
                  <th className="px-4 py-3 font-medium">Grupo</th>
                  <th className="px-4 py-3 text-right font-medium">Saldo</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-raised">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-ink/40"
                    >
                      Sin resultados.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-raised/40">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink/90">{s.name}</p>
                        <p className="text-xs text-ink/40">{s.email}</p>
                        <p className="text-xs text-ink/30">{s.alias}</p>
                      </td>
                      <td className="px-4 py-3">
                        {s.dni || s.cuit ? (
                          <div className="font-mono text-xs">
                            {s.dni && (
                              <p className="text-ink/70">{formatDni(s.dni)}</p>
                            )}
                            {s.cuit && (
                              <p className="text-ink/40">
                                {formatCuit(s.cuit)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-ink/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.groupName ? (
                          <Badge tone="violet">{s.groupName}</Badge>
                        ) : (
                          <span className="text-ink/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-accent">
                        {formatMoney(s.balance)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setEditing(s)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink/60 hover:bg-raised2 hover:text-ink"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {editing && (
        <EditStudentDialog
          student={editing}
          groups={groups}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function CreateStudentForm({ groups }: { groups: GroupOpt[] }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    createUser,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  const groupOptions = useMemo(
    () => [
      { value: "__none__", label: "Sin grupo" },
      ...groups.map((g) => ({ value: g.id, label: g.name })),
    ],
    [groups],
  );

  return (
    <Card className="h-fit">
      <div className="mb-3 flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-accent" />
        <CardTitle className="text-ink/80">Nuevo alumno</CardTitle>
      </div>
      <form ref={ref} action={formAction} className="flex flex-col gap-3">
        <div>
          <Label htmlFor="c-name">Nombre</Label>
          <Input id="c-name" name="name" placeholder="Nombre y apellido" required />
        </div>
        <div>
          <Label htmlFor="c-email">Email (login)</Label>
          <Input id="c-email" name="email" type="email" placeholder="alumno@colepay.edu" required />
        </div>
        <div>
          <Label htmlFor="c-dni">DNI (opcional)</Label>
          <Input
            id="c-dni"
            name="dni"
            inputMode="numeric"
            pattern="\d{7,9}"
            maxLength={9}
            placeholder="45123678"
          />
        </div>
        <div>
          <Label htmlFor="c-cuit">CUIT (opcional)</Label>
          <Input
            id="c-cuit"
            name="cuit"
            inputMode="numeric"
            maxLength={13}
            placeholder="20-45123678-3"
          />
        </div>
        <div>
          <Label htmlFor="c-pass">Contraseña</Label>
          <PasswordInput
            id="c-pass"
            name="password"
            autoComplete="new-password"
            placeholder="mínimo 4 caracteres"
            required
          />
        </div>
        <div>
          <Label htmlFor="c-group">Grupo</Label>
          <SearchSelect
            id="c-group"
            name="groupId"
            options={groupOptions}
            defaultValue="__none__"
            searchPlaceholder="Buscar grupo…"
            emptyMessage="No se encontró ningún grupo."
          />
        </div>
        <div>
          <Label htmlFor="c-role">Rol</Label>
          <Select id="c-role" name="role" defaultValue="STUDENT">
            <option value="STUDENT">Alumno</option>
            <option value="ADMIN">Admin (Profe)</option>
          </Select>
        </div>
        {state && (
          <FormFeedback ok={state.ok} msg={state.ok ? state.message : state.error} />
        )}
        <SubmitBtn label="Crear alumno" />
      </form>
    </Card>
  );
}

function EditStudentDialog({
  student,
  groups,
  onClose,
}: {
  student: StudentRow;
  groups: GroupOpt[];
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    editUser,
    null,
  );
  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(onClose, 700);
      return () => clearTimeout(t);
    }
  }, [state, onClose]);

  const groupOptions = useMemo(
    () => [
      { value: "__none__", label: "Sin grupo" },
      ...groups.map((g) => ({ value: g.id, label: g.name })),
    ],
    [groups],
  );

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <CardTitle className="text-base text-ink/90">Editar alumno</CardTitle>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-ink/50 hover:bg-raised2 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="userId" value={student.id} />
          <div>
            <Label htmlFor="e-name">Nombre</Label>
            <Input id="e-name" name="name" defaultValue={student.name} required />
          </div>
          <div>
            <Label htmlFor="e-email">Email</Label>
            <Input id="e-email" name="email" type="email" defaultValue={student.email} required />
          </div>
          <div>
            <Label htmlFor="e-dni">DNI (opcional)</Label>
            <Input
              id="e-dni"
              name="dni"
              inputMode="numeric"
              pattern="\d{7,9}"
              maxLength={9}
              defaultValue={student.dni ?? ""}
              placeholder="45123678"
            />
          </div>
          <div>
            <Label htmlFor="e-cuit">CUIT (opcional)</Label>
            <Input
              id="e-cuit"
              name="cuit"
              inputMode="numeric"
              maxLength={13}
              defaultValue={student.cuit ? formatCuit(student.cuit) : ""}
              placeholder="20-45123678-3"
            />
          </div>
          <div>
            <Label htmlFor="e-group">Grupo</Label>
            <SearchSelect
              id="e-group"
              name="groupId"
              options={groupOptions}
              defaultValue={student.groupId ?? "__none__"}
              searchPlaceholder="Buscar grupo…"
              emptyMessage="No se encontró ningún grupo."
            />
          </div>
          <div>
            <Label htmlFor="e-pass">Nueva contraseña (opcional)</Label>
            <PasswordInput
            id="e-pass"
            name="password"
            autoComplete="new-password"
            placeholder="Dejar vacío para no cambiar"
          />
          </div>
          {state && (
            <FormFeedback ok={state.ok} msg={state.ok ? state.message : state.error} />
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <SubmitBtn label="Guardar cambios" />
          </div>
        </form>
      </Card>
    </div>
  );
}
