import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { requireStudent } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { taxIdOf } from "@/lib/identity";
import { CARD_BRAND_LABELS, type CardBrandName } from "@/lib/cards";
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

type Person = {
  name: string;
  cuit: string | null;
  dni: string | null;
  wallet: { alias: string; cvu: string } | null;
};

/** Texto de la descripción de una compra con tarjeta, sin la marca interna. */
function cardMessage(description: string): string | null {
  const msg = description.replace(/ \(tarjeta ••••\d{4} de .*\)$/, "").trim();
  return msg && msg !== "Compra con tarjeta" ? msg : null;
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireStudent();
  const { id } = await params;

  // Sólo lo ven las partes: quien envía y quien recibe una transferencia o,
  // en una compra con tarjeta, el titular y el comercio. Para cualquier otro,
  // el comprobante no existe.
  const tx = await prisma.transaction.findFirst({
    where: {
      id,
      OR: [
        {
          type: "TRANSFER",
          OR: [{ senderId: me.id }, { receiverId: me.id }],
        },
        {
          type: "CARD_PURCHASE",
          OR: [
            { receiverId: me.id },
            { cardCharge: { is: { card: { ownerId: me.id } } } },
          ],
        },
      ],
    },
    include: {
      sender: { include: { wallet: true } },
      receiver: { include: { wallet: true } },
      cardCharge: {
        include: {
          card: {
            include: {
              bank: { select: { name: true } },
              owner: { include: { wallet: true } },
            },
          },
        },
      },
    },
  });
  if (!tx) notFound();

  const toParty = (u: Person): Party => {
    const t = taxIdOf(u);
    return {
      name: u.name,
      taxId: t ? `${t.label} ${t.value}` : null,
      alias: u.wallet?.alias ?? null,
      cvu: u.wallet?.cvu ?? null,
    };
  };

  const isCard = tx.type === "CARD_PURCHASE";
  const card = tx.cardCharge?.card ?? null;
  // En una compra con tarjeta paga el titular; el banco sólo adelanta la plata.
  const payer = isCard ? card?.owner : tx.sender;
  const payee = tx.receiver;
  if (!payer || !payee) notFound();

  const from = toParty(payer);
  const to = toParty(payee);
  const iPaid = payer.id === me.id;

  const amount = formatMoney(tx.amount.toString());
  const date = formatDateLong(tx.timestamp);
  const message = isCard
    ? cardMessage(tx.description)
    : tx.description !== "Transferencia"
      ? tx.description
      : null;

  const title = isCard
    ? "Comprobante de compra con tarjeta"
    : "Comprobante de transferencia";
  const verb = iPaid ? (isCard ? "Pagaste" : "Enviaste") : isCard ? "Cobraste" : "Recibiste";
  const fromLabel = isCard ? "Pagó" : "De";
  const toLabel = isCard ? "Comercio" : "Para";

  // Datos propios de la compra con tarjeta, como en un cupón real.
  const cardRows: [string, string][] =
    isCard && card
      ? [
          [
            "Medio de pago",
            `Tarjeta ${CARD_BRAND_LABELS[card.brand as CardBrandName]} ••••${card.last4}`,
          ],
          ["Banco emisor", card.bank.name],
          [
            "Forma de pago",
            iPaid
              ? "1 pago · se suma a tu próximo resumen"
              : "1 pago · acreditado por el banco emisor",
          ],
          ["Estado", "Aprobada"],
          ["Autorización", tx.id.slice(-6).toUpperCase()],
        ]
      : [];

  // Lo que se manda por WhatsApp & co.: legible sin necesidad de abrir la app.
  const shareText = [
    `${title} · ColePay`,
    `Monto: ${amount}`,
    `${fromLabel}: ${from.name}${from.taxId ? ` (${from.taxId})` : ""}`,
    `${toLabel}: ${to.name}${to.taxId ? ` (${to.taxId})` : ""}`,
    !isCard && to.alias ? `Alias destino: ${to.alias}` : null,
    ...cardRows.map(([k, v]) => `${k}: ${v}`),
    `Fecha: ${date}`,
    message ? `Mensaje: ${message}` : null,
    `N° de comprobante: ${tx.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="flex flex-col gap-4 animate-fade-in">
      <div className="print:hidden">
        <h1 className="text-xl font-bold">Comprobante</h1>
        <p className="text-sm text-ink/50">
          {iPaid
            ? isCard
              ? "Guardalo o compartilo como constancia de tu compra."
              : "Guardalo o compartilo con quien recibió el dinero."
            : "Guardalo o imprimilo como constancia de lo que recibiste."}
        </p>
      </div>

      <ReceiptActions shareText={shareText} fileName={`comprobante-${tx.id}`} />

      <Card className="overflow-hidden p-0 print:rounded-none print:border-0 print:shadow-none">
        <div className="flex items-center justify-between gap-3 border-b border-raised2/70 px-5 py-4">
          <Logo size="sm" />
          <p className="text-right text-xs font-medium uppercase tracking-wide text-ink/50">
            {title}
          </p>
        </div>

        <div className="flex flex-col items-center gap-1 px-5 pb-5 pt-6 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-accent/15 text-accent">
            <Check className="h-6 w-6" strokeWidth={3} />
          </div>
          <p className="mt-2 text-sm text-ink/60">{verb}</p>
          <p className="text-4xl font-bold tracking-tight">{amount}</p>
          <p className="text-sm text-ink/50">{date}</p>
        </div>

        <div className="grid gap-3 border-t border-raised2/70 px-5 py-5">
          <PartyBlock label={fromLabel} party={from} you={iPaid} />
          <div className="flex justify-center text-ink/30" aria-hidden>
            <ArrowRight className="h-4 w-4 rotate-90" />
          </div>
          <PartyBlock label={toLabel} party={to} you={!iPaid} />
        </div>

        <dl className="flex flex-col gap-2 border-t border-raised2/70 px-5 py-5 text-sm">
          {cardRows.map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
          {message && <Row label="Mensaje" value={message} />}
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
        className={`min-w-0 break-words text-right ${mono ? "break-all font-mono" : ""} ${small ? "" : "font-medium"}`}
      >
        {value}
      </dd>
    </div>
  );
}
