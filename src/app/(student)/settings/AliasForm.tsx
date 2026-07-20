"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Check } from "lucide-react";
import { updateAlias, type ActionResult } from "@/app/actions/student";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando..." : "Guardar alias"}
    </Button>
  );
}

export function AliasForm({ currentAlias }: { currentAlias: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateAlias,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <Label htmlFor="alias">Tu alias</Label>
        <Input
          id="alias"
          name="alias"
          defaultValue={currentAlias}
          placeholder="mi.alias.colepay"
          autoComplete="off"
          required
        />
        <p className="mt-1.5 px-1 text-xs text-ink/40">
          Es el nombre corto que otros usan para enviarte dinero. Debe ser único.
        </p>
      </div>

      {state && (
        <div
          className={
            state.ok
              ? "flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 text-sm text-accent"
              : "flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
          }
        >
          {state.ok ? (
            <Check className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {state.ok ? state.message : state.error}
        </div>
      )}

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
