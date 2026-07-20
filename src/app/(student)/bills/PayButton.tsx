"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, AlertCircle } from "lucide-react";
import { payInvoice, type ActionResult } from "@/app/actions/student";
import { Button } from "@/components/ui/Button";

function Inner() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Pagando..." : "Pagar"}
    </Button>
  );
}

export function PayButton({ invoiceId }: { invoiceId: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    payInvoice,
    null,
  );
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (state && !state.ok) {
      setFlash(state.error);
      const t = setTimeout(() => setFlash(null), 3000);
      return () => clearTimeout(t);
    }
  }, [state]);

  if (state?.ok) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-accent animate-pop-in">
        <Check className="h-4 w-4" strokeWidth={3} /> Pagado
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={formAction}>
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <Inner />
      </form>
      {flash && (
        <span className="flex items-center gap-1 text-right text-xs text-red-300">
          <AlertCircle className="h-3 w-3" /> {flash}
        </span>
      )}
    </div>
  );
}
