import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { requireStudent } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { taxIdOf } from "@/lib/identity";
import { formatDateLong, formatMoney } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/Logo";
import { ReceiptActions } from "./ReceiptActions";

type Party = {
  name: string;
  taxId: string | null;
  alias: string | null;
  cvu: string | null;
};

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireStudent();
  const { id } = await params;

  // Sólo lo ven quien envió y quien recibió. Para cualquier otro, no existe.
  const tx = await prisma.transaction.findFirst({
    where: {
      id,
      type: "TRANSFER",
      OR: [{ senderId: me.id }, { receiverId: me.id }],
    },
    include: {
      sender: { include: { wallet: true } },
      receiver: { include: { wallet: true } },
    },
  });
  if (!tx || !tx.sender || !tx.receiver) notFound();

  const toParty = (u: NonNullable<typeof tx.sender>): Party => {
    const t = taxIdOf(u);
    return {
      name: u.name,
      taxId: t ? `${t.label} ${t.value}` : null,
      alias: u.wallet?.alias ?? null,
      cvu: u.wallet?.cvu ?? null,
    };
  };
  const from = toParty(tx.sender);
  const to = toParty(tx.receiver);
  const iSent = tx.senderId === me.id;

  const amount = formatMoney(tx.amount.toString());
  const date = formatDateLong(tx.timestamp);

  // Lo que se manda por WhatsApp & co.: legible sin necesidad de abrir la app.
  const shareText = [
    "Comprobante de transferencia · ColePay",
    `Monto: ${amount}`,
    `De: ${from.name}${from.taxId ? ` (${from.taxId})` : ""}`,
    `Para: ${to.name}${to.taxId ? ` (${to.taxId})` : ""}`,
    to.alias ? `Alias destino: ${to.alias}` : null,
    `Fecha: ${date}`,
    tx.description && tx.description !== "Transferencia"
      ? `Mensaje: ${tx.description}`
      : null,
    `N° de comprobante: ${tx.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="print:hidden">
        <h1 className="text-xl font-bold">Comprobante</h1>
        <p className="text-sm text-ink/50">
          {iSent
            ? "Guardalo o compartilo con quien recibió el dinero."
            : "Guardalo o imprimilo como constancia de lo que recibiste."}
        </p>
      </div>

      <ReceiptActions shareText={shareText} fileName={`comprobante-${tx.id}`} />

      <Card className="overflow-hidden p-0 print:rounded-none print:border-0 print:shadow-none">
        <div className="flex items-center justify-between gap-3 border-b border-raised2/70 px-5 py-4">
          <Logo size="sm" />
          <p className="text-xs font-medium uppercase tracking-wide text-ink/50">
            Comprobante de transferencia
          </p>
        </div>

        <div className="flex flex-col items-center gap-1 px-5 pb-5 pt-6 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-accent/15 text-accent">
            <Check className="h-6 w-6" strokeWidth={3} />
          </div>
          <p className="mt-2 text-sm text-ink/60">
            {iSent ? "Enviaste" : "Recibiste"}
          </p>
          <p className="text-4xl font-bold tracking-tight">{amount}</p>
          <p className="text-sm text-ink/50">{date}</p>
        </div>

        <div className="grid gap-3 border-t border-raised2/70 px-5 py-5">
          <PartyBlock label="De" party={from} you={iSent} />
          <div className="flex justify-center text-ink/30" aria-hidden>
            <ArrowRight className="h-4 w-4 rotate-90" />
          </div>
          <PartyBlock label="Para" party={to} you={!iSent} />
        </div>

        <dl className="flex flex-col gap-2 border-t border-raised2/70 px-5 py-5 text-sm">
          {tx.description && tx.description !== "Transferencia" && (
            <Row label="Mensaje" value={tx.description} />
          )}
          {tx.category && <Row label="Categoría" value={tx.category} />}
          <Row label="N° de comprobante" value={tx.id} mono />
        </dl>

        <p className="border-t border-raised2/70 bg-raised/40 px-5 py-3 text-center text-[11px] text-ink/40">
          ColePay · Moneda ficticia con fines educativos
        </p>
      </Card>
    </div>
  );
}

function PartyBlock({
  label,
  party,
  you,
}: {
  label: string;
  party: Party;
  you: boolean;
}) {
  return (
    <div className="rounded-xl border border-raised2/70 bg-raised/30 p-3.5">
      <p className="text-[11px] uppercase tracking-wide text-ink/40">{label}</p>
      <p className="mt-0.5 font-semibold">
        {party.name}
        {you && <span className="ml-1.5 text-xs font-normal text-ink/50">(vos)</span>}
      </p>
      <dl className="mt-1.5 flex flex-col gap-0.5 text-xs text-ink/60">
        {party.taxId && <Row label="Documento" value={party.taxId} small />}
        {party.alias && <Row label="Alias" value={party.alias} mono small />}
        {party.cvu && <Row label="CVU" value={party.cvu} mono small />}
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  small,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={small ? "shrink-0 text-ink/40" : "shrink-0 text-ink/50"}>
        {label}
      </dt>
      <dd
        className={`min-w-0 break-all text-right ${mono ? "font-mono" : ""} ${small ? "" : "font-medium"}`}
      >
        {value}
      </dd>
    </div>
  );
}
