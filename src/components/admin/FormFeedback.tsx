import { AlertCircle, Check } from "lucide-react";

/** Bloque de feedback de éxito/error reutilizable en formularios de admin. */
export function FormFeedback({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <div
      className={
        ok
          ? "flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent"
          : "flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
      }
    >
      {ok ? (
        <Check className="h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      {msg}
    </div>
  );
}
