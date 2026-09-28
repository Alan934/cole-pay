"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, CreditCard, ShieldX, Wand2 } from "lucide-react";
import { approveApplication, rejectApplication } from "@/app/actions/cards";
import type { ActionResult } from "@/app/actions/student";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { CARD_BRANDS, CARD_BRAND_LABELS } from "@/lib/cards";
import { formatDate, formatMoney, cn } from "@/lib/utils";

export type ApplicationReviewData = {
  id: string;
  bankName: string;
  applicantName: string;
  applicantTaxId: string | null;
  applicantGroup: string | null;
  applicantBalance: number;
  requestedLimit: number;
  monthlyIncome: number | null;
  purpose: string | null;
  createdAt: string;
  /** Límite sugerido por la política del banco. */
  suggestedLimit: number;
};

/**
 * Mostrador de atención: el banco mira la solicitud y decide. Al aprobar puede
 * dejar que el sistema invente los datos de la tarjeta o cargarlos a mano,
 * para que la tarjeta virtual sea igual a la de cartón que ya tienen en clase.
 */
export function ApplicationReview({
  application,
  showBank = false,
}: {
  application: ApplicationReviewData;
  /** En la vista de supervisión se aclara de qué banco es la solicitud. */
  showBank?: boolean;
}) {
  const [tab, setTab] = useState<"none" | "approve" | "reject">("none");

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">
              {application.applicantName}
            </h3>
            {application.applicantGroup && (
              <Badge tone="neutral">{application.applicantGroup}</Badge>
            )}
            {showBank && <Badge tone="violet">{application.bankName}</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-ink/45">
            {application.applicantTaxId ?? "Sin DNI/CUIT cargado"} ·{" "}
            {formatDate(application.createdAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink/45">Límite pedido</p>
          <p className="text-lg font-bold">
            {formatMoney(application.requestedLimit)}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <Fact
          label="Ingreso declarado"
          value={
            application.monthlyIncome === null
              ? "No lo declaró"
              : formatMoney(application.monthlyIncome)
          }
        />
        <Fact
          label="Saldo en la billetera"
          value={formatMoney(application.applicantBalance)}
        />
        <Fact
          label="Límite sugerido"
          value={formatMoney(application.suggestedLimit)}
        />
      </dl>

      {application.purpose && (
        <p className="rounded-xl bg-raised/50 px-3 py-2.5 text-sm text-ink/70">
          <span className="font-medium text-ink/85">Para qué la quiere: </span>
          {application.purpose}
        </p>
      )}

      {tab === "none" && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setTab("approve")}>
            <Check className="h-4 w-4" />
            Aprobar y emitir
          </Button>
          <Button variant="outline" onClick={() => setTab("reject")}>
            <ShieldX className="h-4 w-4" />
            Rechazar
          </Button>
        </div>
      )}

      {tab === "approve" && (
        <ApproveForm
          application={application}
          onCancel={() => setTab("none")}
        />
      )}
      {tab === "reject" && (
        <RejectForm
          applicationId={application.id}
          onCancel={() => setTab("none")}
        />
      )}
    </Card>
  );
}

function ApproveForm({
  application,
  onCancel,
}: {
  application: ApplicationReviewData;
  onCancel: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    approveApplication,
    null,
  );
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const year = new Date().getFullYear();

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-accent/30 bg-accent/5 p-4"
    >
      <input type="hidden" name="applicationId" value={application.id} />
      <input type="hidden" name="mode" value={mode} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`limit-${application.id}`}>Límite que le dan</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40">
              $
            </span>
            <Input
              id={`limit-${application.id}`}
              name="creditLimit"
              type="number"
              min="1"
              step="0.01"
              className="pl-8"
              defaultValue={application.requestedLimit}
              required
            />
          </div>
        </div>
        <div>
          <Label htmlFor={`brand-${application.id}`}>Marca</Label>
          <Select
            id={`brand-${application.id}`}
            name="brand"
            defaultValue="VISA"
          >
            {CARD_BRANDS.map((b) => (
              <option key={b} value={b}>
                {CARD_BRAND_LABELS[b]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label>Datos de la tarjeta</Label>
        <div className="grid grid-cols-2 gap-2">
          <ModeButton
            active={mode === "auto"}
            onClick={() => setMode("auto")}
            icon={<Wand2 className="h-4 w-4" />}
            title="Automáticos"
            sub="Los genera el sistema"
            label="Generar los datos de la tarjeta automáticamente"
          />
          <ModeButton
            active={mode === "manual"}
            onClick={() => setMode("manual")}
            icon={<CreditCard className="h-4 w-4" />}
            title="Manuales"
            sub="Los copiás del plástico"
            label="Cargar a mano los datos de la tarjeta"
          />
        </div>
      </div>

      {mode === "manual" && (
        <div className="flex flex-col gap-3 rounded-xl border border-raised2 bg-panel/60 p-3">
          <p className="text-xs text-ink/50">
            Copiá los datos tal cual figuran en la tarjeta física para que las
            dos coincidan. El número tiene que pasar la validación de Luhn, como
            el de una tarjeta real.
          </p>
          <div>
            <Label htmlFor={`number-${application.id}`}>Número (16 dígitos)</Label>
            <Input
              id={`number-${application.id}`}
              name="number"
              inputMode="numeric"
              maxLength={19}
              placeholder="4539 1488 0343 6467"
              className="font-mono"
            />
          </div>
          <div>
            <Label htmlFor={`holder-${application.id}`}>Nombre del titular</Label>
            <Input
              id={`holder-${application.id}`}
              name="holderName"
              maxLength={40}
              placeholder={application.applicantName.toUpperCase()}
              defaultValue={application.applicantName.toUpperCase()}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor={`mm-${application.id}`}>Mes</Label>
              <Input
                id={`mm-${application.id}`}
                name="expMonth"
                type="number"
                min="1"
                max="12"
                placeholder="09"
              />
            </div>
            <div>
              <Label htmlFor={`yy-${application.id}`}>Año</Label>
              <Input
                id={`yy-${application.id}`}
                name="expYear"
                type="number"
                min={year}
                max={year + 20}
                placeholder={String(year + 3)}
              />
            </div>
            <div>
              <Label htmlFor={`cvv-${application.id}`}>Código</Label>
              <Input
                id={`cvv-${application.id}`}
                name="cvv"
                inputMode="numeric"
                maxLength={3}
                placeholder="123"
                className="font-mono"
              />
            </div>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor={`note-${application.id}`}>
          Comentario para el cliente (opcional)
        </Label>
        <Textarea
          id={`note-${application.id}`}
          name="note"
          rows={2}
          maxLength={200}
          placeholder="Ej: te damos un límite menor al pedido hasta ver cómo pagás."
        />
      </div>

      {state && (
        <FormFeedback
          ok={state.ok}
          msg={state.ok ? state.message : state.error}
        />
      )}

      <div className="flex gap-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Volver
        </Button>
        <SubmitButton idle="Emitir la tarjeta" busy="Emitiendo..." />
      </div>
    </form>
  );
}

function RejectForm({
  applicationId,
  onCancel,
}: {
  applicationId: string;
  onCancel: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    rejectApplication,
    null,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4"
    >
      <input type="hidden" name="applicationId" value={applicationId} />
      <div>
        <Label htmlFor={`reason-${applicationId}`}>Motivo del rechazo</Label>
        <Textarea
          id={`reason-${applicationId}`}
          name="reason"
          rows={2}
          maxLength={200}
          placeholder="Ej: todavía no tenés ingresos que respalden ese límite."
          required
        />
        <p className="mt-1.5 px-1 text-xs text-ink/40">
          El motivo le llega al alumno como aviso: escribí algo que le sirva
          para volver a intentarlo.
        </p>
      </div>

      {state && (
        <FormFeedback
          ok={state.ok}
          msg={state.ok ? state.message : state.error}
        />
      )}

      <div className="flex gap-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Volver
        </Button>
        <SubmitButton idle="Rechazar" busy="Rechazando..." danger />
      </div>
    </form>
  );
}

function SubmitButton({
  idle,
  busy,
  danger,
}: {
  idle: string;
  busy: string;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={danger ? "danger" : "primary"}
      className="flex-1"
      disabled={pending}
    >
      {pending ? busy : idle}
    </Button>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  title,
  sub,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "flex flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-accent bg-accent/10"
          : "border-raised2 bg-panel/80 hover:border-raised3",
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {title}
      </span>
      <span className="text-xs text-ink/45">{sub}</span>
    </button>
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
