"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarCheck } from "lucide-react";
import { closeBankPeriod } from "@/app/actions/cards";
import type { ActionResult } from "@/app/actions/student";
import { Button } from "@/components/ui/Button";
import { FormFeedback } from "@/components/admin/FormFeedback";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      <CalendarCheck className="h-4 w-4" />
      {pending ? "Cerrando..." : label}
    </Button>
  );
}

/**
 * Cierra el período y emite los resúmenes. Sin `cardId` cierra todas las
 * tarjetas del banco; con `cardId`, sólo esa.
 */
export function ClosePeriodForm({
  bankId,
  cardId,
  label = "Cerrar el período y emitir resúmenes",
}: {
  bankId: string;
  cardId?: string;
  label?: string;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    closeBankPeriod,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="bankId" value={bankId} />
      {cardId && <input type="hidden" name="cardId" value={cardId} />}
      <Submit label={label} />
      {state && (
        <FormFeedback
          ok={state.ok}
          msg={state.ok ? state.message : state.error}
        />
      )}
    </form>
  );
}
