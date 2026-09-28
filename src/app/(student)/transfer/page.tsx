import { requireStudent } from "@/lib/session";
import { getPayableCards } from "@/lib/cards";
import { TransferForm } from "./TransferForm";

export default async function TransferPage({
  searchParams,
}: {
  searchParams: Promise<{
    to?: string;
    amount?: string;
    desc?: string;
    req?: string;
  }>;
}) {
  const me = await requireStudent();
  const balance = Number(me.wallet?.balance ?? 0);
  const [cards, { to, amount, desc, req }] = await Promise.all([
    getPayableCards(me.id),
    searchParams,
  ]);

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Enviar dinero</h1>
        <p className="text-sm text-ink/50">
          {cards.length > 0
            ? "Pagá con tu saldo o con la tarjeta, usando el CVU o alias."
            : "Transferí a otro alumno usando su CVU o alias."}
        </p>
      </div>
      <TransferForm
        balance={balance}
        cards={cards}
        prefill={{ to, amount, desc, req }}
      />
    </div>
  );
}
