"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Pencil, Ban, X } from "lucide-react";
import { editInvoice, cancelInvoice } from "@/app/actions/admin";
import type { ActionResult } from "@/app/actions/student";
import { Card, CardTitle } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormFeedback } from "@/components/admin/FormFeedback";

export type EditableInvoice = {
  id: string;
  description: string;
  amount: number;
  dueDate: string | null; // yyyy-mm-dd o null
};

function SubmitBtn({ label, variant }: { label: string; variant?: "primary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={pending}>
      {pending ? "..." : label}
    </Button>
  );
}

export function InvoiceRowActions({ invoice }: { invoice: EditableInvoice }) {
  const [dialog, setDialog] = useState<"edit" | "cancel" | null>(null);

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => setDialog("edit")}
          title="Editar"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink/60 hover:bg-raised2 hover:text-ink"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setDialog("cancel")}
          title="Anular"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-300 hover:bg-red-500/15"
        >
          <Ban className="h-3.5 w-3.5" />
        </button>
      </div>

      {dialog === "edit" && (
        <EditDialog invoice={invoice} onClose={() => setDialog(null)} />
      )}
      {dialog === "cancel" && (
        <CancelDialog invoice={invoice} onClose={() => setDialog(null)} />
      )}
    </>
  );
}

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </Card>
    </div>
  );
}

function EditDialog({
  invoice,
  onClose,
}: {
  invoice: EditableInvoice;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    editInvoice,
    null,
  );
  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(onClose, 600);
      return () => clearTimeout(t);
    }
  }, [state, onClose]);

  return (
    <Overlay onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <CardTitle className="text-base text-ink/90">Editar cobro</CardTitle>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-ink/50 hover:bg-raised2 hover:text-ink"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="invoiceId" value={invoice.id} />
        <div>
          <Label htmlFor="ei-desc">Concepto</Label>
          <Input
            id="ei-desc"
            name="description"
            defaultValue={invoice.description}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ei-amount">Monto</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40">
                $
              </span>
              <Input
                id="ei-amount"
                name="amount"
                type="number"
                min="1"
                step="0.01"
                defaultValue={invoice.amount}
                className="pl-7"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ei-due">Vencimiento</Label>
            <Input
              id="ei-due"
              name="dueDate"
              type="date"
              defaultValue={invoice.dueDate ?? ""}
            />
          </div>
        </div>
        {state && (
          <FormFeedback ok={state.ok} msg={state.ok ? state.message : state.error} />
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <SubmitBtn label="Guardar" />
        </div>
      </form>
    </Overlay>
  );
}

function CancelDialog({
  invoice,
  onClose,
}: {
  invoice: EditableInvoice;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    cancelInvoice,
    null,
  );
  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(onClose, 600);
      return () => clearTimeout(t);
    }
  }, [state, onClose]);

  return (
    <Overlay onClose={onClose}>
      <div className="mb-2 flex items-center gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-red-500/15 text-red-300">
          <Ban className="h-5 w-5" />
        </div>
        <CardTitle className="text-base text-ink/90">Anular cobro</CardTitle>
      </div>
      <p className="mb-4 text-sm text-ink/60">
        ¿Seguro que querés anular <strong>{invoice.description}</strong>? El
        alumno dejará de verlo entre sus cuentas a pagar.
      </p>
      {state && (
        <FormFeedback ok={state.ok} msg={state.ok ? state.message : state.error} />
      )}
      <form action={formAction} className="mt-3 flex justify-end gap-2">
        <input type="hidden" name="invoiceId" value={invoice.id} />
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Volver
        </Button>
        <SubmitBtn label="Sí, anular" variant="danger" />
      </form>
    </Overlay>
  );
}
