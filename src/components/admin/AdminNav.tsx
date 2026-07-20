"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Receipt,
  ListOrdered,
  Repeat,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Panel", icon: LayoutDashboard },
  { href: "/admin/students", label: "Alumnos", icon: Users },
  { href: "/admin/groups", label: "Grupos", icon: FolderKanban },
  { href: "/admin/services", label: "Servicios", icon: Receipt },
  { href: "/admin/recurring", label: "Recurrentes", icon: Repeat },
  { href: "/admin/transactions", label: "Transacciones", icon: ListOrdered },
  { href: "/admin/reports", label: "Reportes", icon: BarChart3 },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto">
      {items.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-onaccent"
                : "text-ink/60 hover:bg-raised hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
