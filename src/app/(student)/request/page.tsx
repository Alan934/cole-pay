import { headers } from "next/headers";
import { requireStudent } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { RequestManager } from "./RequestManager";

export default async function RequestPage() {
  const me = await requireStudent();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  const requests = await prisma.paymentRequest.findMany({
    where: { requesterId: me.id },
    include: { payer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const views = requests.map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    description: r.description,
    status: r.status,
    payerName: r.payer?.name ?? null,
  }));

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Cobrar 💸</h1>
        <p className="text-sm text-ink/50">
          Mostrá tu QR o creá un pedido con monto para que te paguen.
        </p>
      </div>
      <RequestManager
        origin={origin}
        alias={me.wallet?.alias ?? ""}
        requests={views}
      />
    </div>
  );
}
