"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus, Pencil, X, Search } from "lucide-react";
import { createUser, editUser } from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/student";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { formatMoney } from "@/lib/utils";

export type StudentRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  balance: number;
  alias: string;
  groupId: string | null;
  groupName: string | null;
};
export type GroupOpt = { id: string; name: string };

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

  const filtered = students.filter((s) =>
    `${s.name} ${s.email} ${s.groupName ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <CreateStudentForm groups={groups} />

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, email o grupo…"
            className="pl-9"
          />
        </div>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-raised text-left text-xs text-ink/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Alumno</th>
                  <th className="px-4 py-3 font-medium">Grupo</th>
                  <th className="px-4 py-3 text-right font-medium">Saldo</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-raised">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
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
          <Label htmlFor="c-pass">Contraseña</Label>
          <Input id="c-pass" name="password" type="text" placeholder="mínimo 4 caracteres" required />
        </div>
        <div>
          <Label htmlFor="c-group">Grupo</Label>
          <Select id="c-group" name="groupId" defaultValue="__none__">
            <option value="__none__">Sin grupo</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
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
            <Label htmlFor="e-group">Grupo</Label>
            <Select
              id="e-group"
              name="groupId"
              defaultValue={student.groupId ?? "__none__"}
            >
              <option value="__none__">Sin grupo</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="e-pass">Nueva contraseña (opcional)</Label>
            <Input id="e-pass" name="password" type="text" placeholder="Dejar vacío para no cambiar" />
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
