import { requireStudent } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { BottomNav } from "@/components/student/BottomNav";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireStudent();
  const unread = await prisma.notification.count({
    where: { userId: me.id, read: false },
  });

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-raised/60 bg-canvas/70 px-4 py-3 backdrop-blur">
        <Logo size="sm" />
        <div className="flex items-center gap-1">
          <span className="hidden text-sm text-ink/50 sm:inline">
            {me.name}
          </span>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-5">{children}</main>

      <BottomNav unread={unread} />
    </div>
  );
}
