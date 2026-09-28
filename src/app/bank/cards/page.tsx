import { CreditCard as CreditCardIcon } from "lucide-react";
import { requireBankStaff } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { bankCardInclude, toBankCardView } from "@/lib/card-views";
import { BankCardRow } from "@/components/cards/BankCardRow";
import { Card, CardTitle } from "@/components/ui/Card";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BankCardsPage() {
  const me = await requireBankStaff();
  const bank = me.bank;
  if (!bank) return null;

  const cards = await prisma.creditCard.findMany({
    where: { bankId: bank.id },
    include: bankCardInclude,
    orderBy: [{ status: "asc" }, { issuedAt: "desc" }],
  });

  const views = cards.map(toBankCardView);
  const lent = views.reduce((acc, c) => acc + c.debt, 0);
  const inMora = views.filter((c) => c.overdueCount > 0).length;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Tarjetas emitidas</h1>
        <p className="text-sm text-ink/50">
          Subí o bajá el límite, bloqueá una tarjeta y cerrá el resumen de cada
          cliente.
        </p>
      </div>

      {views.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-raised2 text-ink/50">
            <CreditCardIcon className="h-7 w-7" />
          </div>
          <div>
            <CardTitle className="text-base text-ink">
              Todavía no emitiste ninguna tarjeta
            </CardTitle>
            <p className="mt-1 text-sm text-ink/50">
              Aprobá una solicitud y la tarjeta aparece acá.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <p className="text-sm text-ink/55">
            {views.length}{" "}
            {views.length === 1 ? "tarjeta emitida" : "tarjetas emitidas"} ·{" "}
            {formatMoney(lent)} prestados
            {inMora > 0 && ` · ${inMora} en mora`}
          </p>
          <div className="flex flex-col gap-3">
            {views.map((card) => (
              <BankCardRow key={card.id} card={card} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
