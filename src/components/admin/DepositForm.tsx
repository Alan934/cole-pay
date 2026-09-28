"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Wallet } from "lucide-react";
import { depositToStudent } from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/student";
import { Input, Label } from "@/components/ui/Input";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/utils";
import { FormFeedback } from "./FormFeedback";

type StudentOption = { id: string; name: string; group: string | null };
type GroupOption = { id: string; name: string; students: number };

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <Wallet className="h-4 w-4" />
      {pending ? "Cargando..." : label}
    </Button>
  );
}

export function DepositForm({
  students,
  groups,
}: {
  students: StudentOption[];
  groups: GroupOption[];
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    depositToStudent,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<"student" | "group">("student");
  const [groupId, setGroupId] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      setAmount("");
    }
  }, [state]);

  const studentOptions = useMemo(
    () => students.map((s) => ({ value: s.id, label: s.name, hint: s.group })),
    [students],
  );
  const groupOptions = useMemo(
    () =>
      groups.map((g) => ({
        value: g.id,
        label: g.name,
        hint: `${g.students} ${g.students === 1 ? "alumno" : "alumnos"}`,
      })),
    [groups],
  );

  // Con un curso elegido conviene ver el total antes de apretar: el importe es
  // por alumno, no una bolsa a repartir.
  const group = groups.find((g) => g.id === groupId);
  const perStudent = Number(amount);
  const total =
    group && Number.isFinite(perStudent) && perStudent > 0
      ? perStudent * group.students
      : null;

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-3">
      <div>
        <Label>Cargar a</Label>
        <div className="mb-3 flex gap-2">
          <ModeButton
            active={mode === "student"}
            onClick={() => setMode("student")}
            label="Un alumno"
          />
          <ModeButton
            active={mode === "group"}
            onClick={() => setMode("group")}
            label="Un curso entero"
          />
        </div>

        {mode === "student" ? (
          <SearchSelect
            id="dep-student"
            name="studentId"
            aria-label="Alumno"
            options={studentOptions}
            required
            placeholder="Seleccioná un alumno…"
            searchPlaceholder="Buscar por nombre o grupo…"
            emptyMessage="No se encontró ningún alumno."
          />
        ) : (
          <SearchSelect
            id="dep-group"
            name="groupId"
            aria-label="Curso"
            options={groupOptions}
            required
            placeholder="Seleccioná un curso…"
            searchPlaceholder="Buscar curso…"
            emptyMessage="No hay cursos cargados."
            onChange={setGroupId}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="dep-amount">
            {mode === "group" ? "Monto por alumno" : "Monto"}
          </Label>
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
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor="dep-desc">Concepto (opcional)</Label>
          <Input id="dep-desc" name="description" placeholder="Efectivo" />
        </div>
      </div>

      {mode === "group" && total !== null && group && (
        <p className="rounded-xl border border-raised2 bg-raised/30 px-3 py-2 text-xs text-ink/60">
          {formatMoney(perStudent)} a cada uno de los {group.students} alumnos de{" "}
          <span className="font-medium text-ink/80">{group.name}</span> ={" "}
          <span className="font-semibold text-accent">{formatMoney(total)}</span>{" "}
          en total.
        </p>
      )}

      {state && (
        <FormFeedback ok={state.ok} msg={state.ok ? state.message : state.error} />
      )}
      <Submit label={mode === "group" ? "Cargar a todo el curso" : "Cargar saldo"} />
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
