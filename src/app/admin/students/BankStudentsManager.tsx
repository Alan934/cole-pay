"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus, Pencil, X, Search, FilterX, Landmark } from "lucide-react";
import { createUser, editUser } from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/student";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { useFuzzyList } from "@/lib/fuzzy";
import { formatCuit, formatDni } from "@/lib/identity";

export type BankStudentRow = {
  id: string;
  name: string;
  email: string;
  dni: string | null;
  cuit: string | null;
  bankId: string | null;
  bankName: string | null;
  bankColor: string | null;
};
export type BankOpt = { id: string; name: string; active: boolean };

/** Constante a nivel módulo: fuse.js reindexa si cambia la referencia. */
const STUDENT_KEYS = ["name", "email", "dni", "cuit", "bankName"];

/** Valor del filtro de banco: un id, o estos dos casos especiales. */
const ALL = "__all__";
/** Alumnos que quedaron sueltos (se les cerró el banco, o vienen de antes). */
const NO_BANK = "__none__";

const collator = new Intl.Collator("es", { sensitivity: "base" });

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando..." : label}
    </Button>
  );
}

/** Opciones del combobox de bancos, avisando cuáles están cerrados. */
function bankOptions(banks: BankOpt[]) {
  return banks.map((b) => ({
    value: b.id,
    label: b.name,
    hint: b.active ? null : "cerrado",
  }));
}

/**
 * Alta y administración de los alumnos de quinto: los que atienden el
 * mostrador. No tienen billetera ni curso, así que lo único que se elige por
 * cada uno es el banco donde trabaja.
 */
export function BankStudentsManager({
  students,
  banks,
}: {
  students: BankStudentRow[];
  banks: BankOpt[];
}) {
  const [query, setQuery] = useState("");
  const [bankId, setBankId] = useState(ALL);
  const [editing, setEditing] = useState<BankStudentRow | null>(null);
  // El SearchSelect es no controlado: se remonta para reflejar los cambios
  // que no vienen de él (limpiar filtros, clic en el banco de la tabla).
  const [bankFieldKey, setBankFieldKey] = useState(0);

  const filterOptions = useMemo(
    () => [
      { value: ALL, label: "Todos los bancos" },
      { value: NO_BANK, label: "Sin banco" },
      ...banks.map((b) => ({ value: b.id, label: b.name })),
    ],
    [banks],
  );

  // Primero el filtro exacto y después la búsqueda difusa: así fuse indexa
  // menos y el nombre de un banco no trae alumnos de otro.
  const scoped = useMemo(
    () =>
      students.filter(
        (s) =>
          bankId === ALL ||
          (bankId === NO_BANK ? s.bankId === null : s.bankId === bankId),
      ),
    [students, bankId],
  );

  const found = useFuzzyList(scoped, STUDENT_KEYS, query);
  const filtered = useMemo(
    () => [...found].sort((a, b) => collator.compare(a.name, b.name)),
    [found],
  );

  const selectedBank =
    bankId === ALL || bankId === NO_BANK
      ? null
      : banks.find((b) => b.id === bankId) ?? null;
  const dirty = query !== "" || bankId !== ALL;

  function pickBank(value: string) {
    setBankId(value);
    setBankFieldKey((k) => k + 1);
  }

  function clearFilters() {
    setQuery("");
    setBankId(ALL);
    setBankFieldKey((k) => k + 1);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <CreateBankStudentForm banks={banks} />

      <div className="flex flex-col gap-3">
        <Card className="flex flex-col gap-3 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre, apellido, email, DNI o CUIT…"
              aria-label="Buscar alumno"
              className="pl-9"
            />
          </div>

          <SearchSelect
            key={bankFieldKey}
            name="filter-bank"
            aria-label="Filtrar por banco"
            options={filterOptions}
            defaultValue={bankId}
            placeholder="Todos los bancos"
            searchPlaceholder="Buscar banco…"
            emptyMessage="No se encontró ningún banco."
            onChange={setBankId}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink/50">
              {filtered.length} de {students.length} alumno(s)
              {selectedBank && (
                <>
                  {" · "}
                  <span className="text-violet">{selectedBank.name}</span>
                </>
              )}
              {bankId === NO_BANK && " · sin banco"}
            </p>
            {dirty && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink/60 transition-colors hover:bg-raised2 hover:text-ink"
              >
                <FilterX className="h-3.5 w-3.5" />
                Limpiar filtros
              </button>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-raised text-left text-xs text-ink/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Alumno</th>
                  <th className="px-4 py-3 font-medium">DNI / CUIT</th>
                  <th className="px-4 py-3 font-medium">Banco</th>
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
                      {students.length === 0
                        ? "Todavía no cargaste ningún alumno de quinto."
                        : "Sin resultados."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-raised/40">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink/90">{s.name}</p>
                        <p className="text-xs text-ink/40">{s.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        {s.dni || s.cuit ? (
                          <div className="font-mono text-xs">
                            {s.dni && (
                              <p className="text-ink/70">{formatDni(s.dni)}</p>
                            )}
                            {s.cuit && (
                              <p className="text-ink/40">{formatCuit(s.cuit)}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-ink/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.bankName && s.bankId ? (
                          <button
                            type="button"
                            onClick={() => pickBank(s.bankId!)}
                            title={`Ver sólo ${s.bankName}`}
                            className="inline-flex items-center gap-2 rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                          >
                            {s.bankColor && (
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: s.bankColor }}
                              />
                            )}
                            <Badge tone="violet">{s.bankName}</Badge>
                          </button>
                        ) : (
                          <Badge tone="warning">Sin banco</Badge>
                        )}
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
        <EditBankStudentDialog
          student={editing}
          banks={banks}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function CreateBankStudentForm({ banks }: { banks: BankOpt[] }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    createUser,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  const options = useMemo(() => bankOptions(banks), [banks]);

  return (
    <Card className="h-fit">
      <div className="mb-3 flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-accent" />
        <CardTitle className="text-ink/80">Nuevo alumno de quinto</CardTitle>
      </div>

      {banks.length === 0 ? (
        <p className="flex items-start gap-2 text-sm text-ink/60">
          <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" />
          Todavía no hay bancos. Creá el primero en la sección Bancos: cada
          alumno tiene que quedar asignado a uno.
        </p>
      ) : (
        <form ref={ref} action={formAction} className="flex flex-col gap-3">
          <div>
            <Label htmlFor="c-name">Nombre</Label>
            <Input
              id="c-name"
              name="name"
              placeholder="Nombre y apellido"
              required
            />
          </div>
          <div>
            <Label htmlFor="c-email">Email (login)</Label>
            <Input
              id="c-email"
              name="email"
              type="email"
              placeholder="alumno@colepay.edu"
              required
            />
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
            <Label htmlFor="c-bank">Banco</Label>
            <SearchSelect
              id="c-bank"
              name="bankId"
              options={options}
              required
              placeholder="Elegí el banco…"
              searchPlaceholder="Buscar banco…"
              emptyMessage="No se encontró ningún banco."
            />
            <p className="mt-1.5 text-xs text-ink/40">
              Es el mostrador que va a atender. Después lo podés cambiar.
            </p>
          </div>
          {state && (
            <FormFeedback
              ok={state.ok}
              msg={state.ok ? state.message : state.error}
            />
          )}
          <SubmitBtn label="Crear alumno" />
        </form>
      )}
    </Card>
  );
}

function EditBankStudentDialog({
  student,
  banks,
  onClose,
}: {
  student: BankStudentRow;
  banks: BankOpt[];
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

  const options = useMemo(() => bankOptions(banks), [banks]);

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
          <CardTitle className="text-base text-ink/90">
            Editar alumno de quinto
          </CardTitle>
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
            <Input
              id="e-name"
              name="name"
              defaultValue={student.name}
              required
            />
          </div>
          <div>
            <Label htmlFor="e-email">Email</Label>
            <Input
              id="e-email"
              name="email"
              type="email"
              defaultValue={student.email}
              required
            />
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
            <Label htmlFor="e-bank">Banco</Label>
            <SearchSelect
              id="e-bank"
              name="bankId"
              options={options}
              defaultValue={student.bankId ?? ""}
              required
              placeholder="Elegí el banco…"
              searchPlaceholder="Buscar banco…"
              emptyMessage="No se encontró ningún banco."
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
            <FormFeedback
              ok={state.ok}
              msg={state.ok ? state.message : state.error}
            />
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
