"use client";

import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { markNotificationsRead } from "@/app/actions/student";

export function MarkReadButton() {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => markNotificationsRead())}
      disabled={pending}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline disabled:opacity-50"
    >
      <CheckCheck className="h-4 w-4" />
      {pending ? "..." : "Marcar leídas"}
    </button>
  );
}
