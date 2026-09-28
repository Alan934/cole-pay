"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus } from "lucide-react";
import { createBankUser } from "@/app/actions/banks";
import type { ActionResult } from "@/app/actions/student";
import { Input, Label, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormFeedback } from "@/components/admin/FormFeedback";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <UserPlus className="h-4 w-4" />
      {pending ? "Creando..." : "Crear usuario"}
    </Button>
  );
}

/**
 * Alta de un alumno de quinto (o de otra profe). No llevan billetera: su
 * trabajo es atender el banco, no manejar una cuenta personal.
 */
export function CreateBankUserForm({
  banks,
  defaultBankId,
}: {
  banks: { id: string; name: string }[];
  defaultBankId?: string;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    createBankUser,
    null,
  );
  const [role, setRole] = useState("BANK_EMPLOYEE");
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="bu-name">Nombre y apellido</Label>
          <Input id="bu-name" name="name" placeholder="Sofía Pérez" required />
        </div>
        <div>
          <Label htmlFor="bu-email">Email</Label>
          <Input
            id="bu-email"
            name="email"
            type="email"
            placeholder="sofia@colepay.local"
            required
          />
        </div>
        <div>
          <Label htmlFor="bu-dni">DNI (opcional)</Label>
          <Input id="bu-dni" name="dni" inputMode="numeric" placeholder="45123678" />
        </div>
        <div>
          <Label htmlFor="bu-password">Contraseña</Label>
          <Input
            id="bu-password"
            name="password"
            type="text"
            minLength={4}
            placeholder="mínimo 4 caracteres"
            required
          />
        </div>
        <div>
          <Label htmlFor="bu-role">Rol</Label>
          <Select
            id="bu-role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="BANK_EMPLOYEE">
              Alumno de quinto (empleado del banco)
            </option>
            <option value="BANK_ADMIN">Profe de quinto</option>
          </Select>
        </div>
        {role === "BANK_EMPLOYEE" && (
          <div>
            <Label htmlFor="bu-bank">Banco</Label>
            <Select id="bu-bank" name="bankId" defaultValue={defaultBankId ?? "__none__"}>
              <option value="__none__">Sin asignar por ahora</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {state && (
        <FormFeedback
          ok={state.ok}
          msg={state.ok ? state.message : state.error}
        />
      )}
      <Submit />
    </form>
  );
}
