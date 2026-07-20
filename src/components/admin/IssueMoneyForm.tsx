"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Sparkles, AlertCircle, Check } from "lucide-react";
import { issueMoney } from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/student";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      <Sparkles className="h-4 w-4" />
      {pending ? "Emitiendo..." : "Emitir"}
    </Button>
  );
}

export function IssueMoneyForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    issueMoney,
    null,
  );
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-3">
      <div>
        <Label htmlFor="issue-amount">Monto a crear</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40">
              $
            </span>
            <Input
              id="issue-amount"
              name="amount"
              type="number"
              min="1"
              step="0.01"
              placeholder="10000"
              className="pl-7"
              required
            />
          </div>
          <Submit />
        </div>
      </div>
      {state && (
        <Feedback ok={state.ok} msg={state.ok ? state.message : state.error} />
      )}
    </form>
  );
}

function Feedback({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <div
      className={
        ok
          ? "flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent"
          : "flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
      }
    >
      {ok ? (
        <Check className="h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      {msg}
    </div>
  );
}
