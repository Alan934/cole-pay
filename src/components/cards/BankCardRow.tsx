"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronDown } from "lucide-react";
import { updateCard } from "@/app/actions/cards";
import type { ActionResult } from "@/app/actions/student";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { ClosePeriodForm } from "@/components/cards/ClosePeriodForm";
import { formatExpiry } from "@/lib/cards";
import { formatMoney, cn } from "@/lib/utils";

export type BankCardView = {
  id: string;
  bankId: string;
  bankName: string;
  ownerName: string;
  ownerGroup: string | null;
  brandLabel: string;
  last4: string;
  holderName: string;
  expMonth: number;
  expYear: number;
  status: "ACTIVE" | "BLOCKED" | "CANCELLED";
  expired: boolean;
  creditLimit: number;
  debt: number;
  currentPeriod: number;
  billed: number;
  overdueCount: number;
  lastClosedAt: string | null;
};

const STATUS: Record<
  string,
  { label: string; tone: "success" | "warning" | "neutral" }
> = {
  ACTIVE: { label: "Activa", tone: "success" },
  BLOCKED: { label: "Bloqueada", tone: "warning" },
  CANCELLED: { label: "De baja", tone: "neutral" },
};

/** Ficha de una tarjeta emitida, con lo que el banco puede hacerle. */
export function BankCardRow({
  card,
  showBank = false,
}: {
  card: BankCardView;
  showBank?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const badge = STATUS[card.status];

  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold">{card.ownerName}</span>
            {card.ownerGroup && <Badge tone="neutral">{card.ownerGroup}</Badge>}
            {showBank && <Badge tone="violet">{card.bankName}</Badge>}
            {card.overdueCount > 0 && <Badge tone="danger">En mora</Badge>}
          </div>
          <p className="mt-0.5 truncate text-xs text-ink/45">
            {card.brandLabel} ••••{card.last4} · vence{" "}
            {formatExpiry(card.expMonth, card.expYear)}
            {card.expired && " · vencida"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-[11px] text-ink/45">Debe</p>
            <p
              className={cn(
                "font-semibold",
                card.debt > 0 ? "text-violet" : "text-ink/60",
              )}
            >
              {formatMoney(card.debt)}
            </p>
          </div>
          <Badge tone={badge.tone}>{badge.label}</Badge>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-ink/40 transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-raised2/70 p-4">
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Fact label="Límite" value={formatMoney(card.creditLimit)} />
            <Fact
              label="Sin facturar"
              value={formatMoney(card.currentPeriod)}
            />
            <Fact label="Resúmenes impagos" value={formatMoney(card.billed)} />
            <Fact
              label="Último cierre"
              value={
                card.lastClosedAt
                  ? new Date(card.lastClosedAt).toLocaleDateString("es-AR")
                  : "Nunca"
              }
            />
          </dl>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <UpdateCardForm card={card} />
            <div className="flex flex-col justify-end gap-2">
              <p className="text-xs text-ink/45">
                Cerrar el período de esta tarjeta emite su resumen con los
                consumos que tenga hasta hoy.
              </p>
              <ClosePeriodForm
                bankId={card.bankId}
                cardId={card.id}
                label="Cerrar sólo esta tarjeta"
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function UpdateCardForm({ card }: { card: BankCardView }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateCard,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="cardId" value={card.id} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={`cl-${card.id}`}>Límite</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40">
              $
            </span>
            <Input
              id={`cl-${card.id}`}
              name="creditLimit"
              type="number"
              min="1"
              step="0.01"
              className="pl-8"
              defaultValue={card.creditLimit}
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor={`st-${card.id}`}>Estado</Label>
          <Select
            id={`st-${card.id}`}
            name="status"
            defaultValue={card.status}
          >
            <option value="ACTIVE">Activa</option>
            <option value="BLOCKED">Bloqueada</option>
            <option value="CANCELLED">Dar de baja</option>
          </Select>
        </div>
      </div>
      <SaveButton />
      {state && (
        <FormFeedback
          ok={state.ok}
          msg={state.ok ? state.message : state.error}
        />
      )}
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Guardando..." : "Guardar cambios"}
    </Button>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-raised/50 px-3 py-2">
      <dt className="text-[11px] text-ink/45">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );
}
