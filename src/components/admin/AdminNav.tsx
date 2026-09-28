"use client";

import { usePathname } from "next/navigation";
import { NavLink, NavIcon } from "@/components/NavProgress";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Receipt,
  ListOrdered,
  Repeat,
  BarChart3,
  TrendingUp,
  Landmark,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Panel", icon: LayoutDashboard },
  { href: "/admin/students", label: "Alumnos", icon: Users },
  { href: "/admin/groups", label: "Grupos", icon: FolderKanban },
  { href: "/admin/services", label: "Servicios", icon: Receipt },
  { href: "/admin/recurring", label: "Recurrentes", icon: Repeat },
  { href: "/admin/banks", label: "Bancos", icon: Landmark },
  { href: "/admin/cards", label: "Tarjetas", icon: CreditCard },
  { href: "/admin/rendimientos", label: "Rendimientos", icon: TrendingUp },
  { href: "/admin/transactions", label: "Transacciones", icon: ListOrdered },
  { href: "/admin/reports", label: "Reportes", icon: BarChart3 },
];

/** Lo que ve la profe de quinto: el universo bancario y los alumnos. */
const BANK_ADMIN_HREFS = ["/admin/banks", "/admin/cards", "/admin/students"];

export function AdminNav({ role }: { role?: string }) {
  const pathname = usePathname();
  const visible =
    role === "BANK_ADMIN"
      ? items.filter((i) => BANK_ADMIN_HREFS.includes(i.href))
      : items;

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {visible.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <NavLink
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-onaccent"
                : "text-ink/60 hover:bg-raised hover:text-ink",
            )}
          >
            <NavIcon icon={Icon} className="h-4 w-4" />
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}
