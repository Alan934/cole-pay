import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { requireStudent } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getActiveTerms } from "@/lib/settings";
import { simpleInterest } from "@/lib/interest";
import { DepositsManager } from "./DepositsManager";

export default async function DepositsPage() {
  const me = await requireStudent();
  const [deposits, terms] = await Promise.all([
    prisma.fixedDeposit.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: "desc" },
    }),
    getActiveTerms(),
  ]);

  const now = new Date();
  const views = deposits.map((d) => {
    const principal = Number(d.principal);
    const tnaPct = Number(d.ratePct);
    const interest = simpleInterest(principal, tnaPct, d.termDays);
    return {
      id: d.id,
      principal,
      tnaPct,
      termDays: d.termDays,
      interest,
      maturesAt: d.maturesAt.toISOString(),
      matured: d.maturesAt <= now,
      status: d.status,
      payout: d.payoutAmount ? Number(d.payoutAmount) : null,
      estimatedPayout: principal + interest,
    };
  });

  const termOptions = terms.map((t) => ({
    days: t.days,
    tnaPct: Number(t.tnaPct),
  }));
  const balance = Number(me.wallet?.balance ?? 0);

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Plazo fijo 🏦</h1>
        <p className="text-sm text-ink/50">
          Inmovilizás tu plata un tiempo y el banco te paga por eso.
        </p>
      </div>

      <Link
        href="/rendimientos"
        className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm text-ink/70 transition-colors hover:border-accent/60"
      >
        <GraduationCap className="h-4 w-4 shrink-0 text-accent" />
        <span>
          ¿No sabés qué es la TNA?{" "}
          <span className="font-medium text-accent">Aprendé y calculá acá</span>
        </span>
      </Link>

      <DepositsManager
        deposits={views}
        balance={balance}
        terms={termOptions}
      />
    </div>
  );
}
