"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { FolderPlus } from "lucide-react";
import { createGroup } from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/student";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormFeedback } from "@/components/admin/FormFeedback";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <FolderPlus className="h-4 w-4" />
      {pending ? "Creando..." : "Crear grupo"}
    </Button>
  );
}

export function CreateGroupForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    createGroup,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-3">
      <div>
        <Label htmlFor="g-name">Nombre del grupo</Label>
        <div className="flex gap-2">
          <Input id="g-name" name="name" placeholder="ej: 3A2026" required />
          <Submit />
        </div>
      </div>
      {state && (
        <FormFeedback ok={state.ok} msg={state.ok ? state.message : state.error} />
      )}
    </form>
  );
}
