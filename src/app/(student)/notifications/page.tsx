import { Bell, Sparkles, Receipt, ArrowDownLeft } from "lucide-react";
import { requireStudent } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatDate, cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { MarkReadButton } from "./MarkReadButton";

const iconMap: Record<string, { icon: typeof Bell; tone: string }> = {
  MONEY_RECEIVED: { icon: ArrowDownLeft, tone: "bg-accent/15 text-accent" },
  NEW_INVOICE: { icon: Receipt, tone: "bg-amber-500/15 text-amber-300" },
  INVOICE_PAID: { icon: Receipt, tone: "bg-emerald-500/15 text-emerald-300" },
  GENERIC: { icon: Sparkles, tone: "bg-violet/15 text-violet" },
};

export default async function NotificationsPage() {
  const me = await requireStudent();
  const notifications = await prisma.notification.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Notificaciones</h1>
          <p className="text-sm text-ink/50">Tus avisos recientes.</p>
        </div>
        {hasUnread && <MarkReadButton />}
      </div>

      {notifications.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center text-ink/40">
          <Bell className="h-8 w-8" />
          <p className="text-sm">No tenés notificaciones.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => {
            const { icon: Icon, tone } = iconMap[n.type] ?? iconMap.GENERIC;
            return (
              <Card
                key={n.id}
                className={cn(
                  "flex items-start gap-3 py-3.5",
                  !n.read && "border-accent/30 bg-accent/[0.04]",
                )}
              >
                <div
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                    tone,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{n.title}</p>
                    {!n.read && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                    )}
                  </div>
                  <p className="text-sm text-ink/60">{n.body}</p>
                  <p className="mt-0.5 text-xs text-ink/30">
                    {formatDate(n.createdAt)}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
