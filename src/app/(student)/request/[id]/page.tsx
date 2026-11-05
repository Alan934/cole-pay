import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { RequestDetail } from "./RequestDetail";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireStudent();
  const { id } = await params;

  // Sólo quien creó el cobro ve su QR.
  const r = await prisma.paymentRequest.findFirst({
    where: { id, requesterId: me.id },
    include: { payer: { select: { name: true } } },
  });
  if (!r) notFound();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";

  return (
    <RequestDetail
      origin={`${proto}://${host}`}
      alias={me.wallet?.alias ?? ""}
      r={{
        id: r.id,
        amount: Number(r.amount),
        description: r.description,
        status: r.status,
        payerName: r.payer?.name ?? null,
        transactionId: r.transactionId,
      }}
    />
  );
}
