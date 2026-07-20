import { logout } from "@/app/actions/auth";
import { LogOut } from "lucide-react";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logout}>
      <button
        type="submit"
        className={
          className ??
          "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink/60 transition-colors hover:bg-raised hover:text-ink"
        }
      >
        <LogOut className="h-4 w-4" />
        Salir
      </button>
    </form>
  );
}
