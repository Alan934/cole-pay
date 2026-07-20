import { requireAdmin } from "@/lib/session";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { AdminNav } from "@/components/admin/AdminNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/Badge";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-raised/60 bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size="sm" />
              <Badge tone="violet">Admin</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-ink/50 sm:inline">
                {admin.name}
              </span>
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
          <AdminNav />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
