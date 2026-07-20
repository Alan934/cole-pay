"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ArrowLeftRight, Receipt, Bell, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/transfer", label: "Enviar", icon: ArrowLeftRight },
  { href: "/bills", label: "Pagar", icon: Receipt },
  { href: "/notifications", label: "Avisos", icon: Bell },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

export function BottomNav({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-raised2/70 bg-panel/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-1.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-colors",
                active ? "text-accent" : "text-ink/45 hover:text-ink/80",
              )}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {href === "/notifications" && unread > 0 && (
                  <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-onaccent">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
