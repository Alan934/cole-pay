"use client";

import { usePathname } from "next/navigation";
import { NavLink, NavIcon } from "@/components/NavProgress";
import {
  Banknote,
  CreditCard,
  FileSignature,
  HandCoins,
  Inbox,
  Landmark,
  LayoutDashboard,
  PiggyBank,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/bank", label: "Mostrador", icon: LayoutDashboard },
  { href: "/bank/clients", label: "Clientes", icon: Users },
  { href: "/bank/applications", label: "Solicitudes", icon: Inbox },
  { href: "/bank/cards", label: "Tarjetas", icon: CreditCard },
  { href: "/bank/loans", label: "Préstamos", icon: HandCoins },
  { href: "/bank/cheques", label: "Cheques", icon: FileSignature },
  { href: "/bank/caja", label: "Ventanilla", icon: Banknote },
  { href: "/bank/deposits", label: "Plazos fijos", icon: PiggyBank },
  { href: "/bank/account", label: "Cuenta", icon: Landmark },
];

export function BankNav({
  pending = 0,
  pendingLoans = 0,
  pendingCheques = 0,
}: {
  pending?: number;
  pendingLoans?: number;
  pendingCheques?: number;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto">
      {items.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/bank" ? pathname === "/bank" : pathname.startsWith(href);
        const badge =
          href === "/bank/applications"
            ? pending
            : href === "/bank/loans"
              ? pendingLoans
              : href === "/bank/cheques"
                ? pendingCheques
                : 0;
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
            {badge > 0 && (
              <span
                className={cn(
                  "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold",
                  active ? "bg-onaccent/20 text-onaccent" : "bg-warning text-canvas",
                )}
              >
                {badge > 9 ? "9+" : badge}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
