"use client";

import { useState } from "react";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { formatMoney } from "@/lib/utils";

export function BalanceCard({
  balance,
  cvu,
  alias,
}: {
  balance: number;
  cvu: string;
  alias: string;
}) {
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState<"cvu" | "alias" | null>(null);

  const copy = async (value: string, which: "cvu" | "alias") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      /* clipboard no disponible */
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-base-700/70 bg-gradient-to-br from-base-800 to-base-900 p-6 shadow-card">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-violet/10 blur-2xl" />

      <div className="relative flex items-center justify-between">
        <span className="text-sm text-white/50">Saldo disponible</span>
        <button
          onClick={() => setHidden((h) => !h)}
          className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-base-700 hover:text-white"
          aria-label={hidden ? "Mostrar saldo" : "Ocultar saldo"}
        >
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <p className="relative mt-1 text-4xl font-bold tracking-tight">
        {hidden ? "$ •••••" : formatMoney(balance)}
      </p>

      <div className="relative mt-6 flex flex-col gap-2 text-sm">
        <button
          onClick={() => copy(alias, "alias")}
          className="flex items-center justify-between rounded-xl bg-base-950/40 px-3 py-2 text-left transition-colors hover:bg-base-950/70"
        >
          <span className="text-white/40">Alias</span>
          <span className="flex items-center gap-2 font-medium text-white/90">
            {alias}
            {copied === "alias" ? (
              <Check className="h-3.5 w-3.5 text-accent" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-white/40" />
            )}
          </span>
        </button>
        <button
          onClick={() => copy(cvu, "cvu")}
          className="flex items-center justify-between rounded-xl bg-base-950/40 px-3 py-2 text-left transition-colors hover:bg-base-950/70"
        >
          <span className="text-white/40">CVU</span>
          <span className="flex items-center gap-2 font-mono text-xs text-white/90">
            {cvu}
            {copied === "cvu" ? (
              <Check className="h-3.5 w-3.5 text-accent" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-white/40" />
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
