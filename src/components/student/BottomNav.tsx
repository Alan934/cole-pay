"use client";

import { usePathname } from "next/navigation";
import {
  Home,
  ArrowLeftRight,
  CreditCard,
  Receipt,
  Bell,
  Settings,
  ScanQrCode,
} from "lucide-react";
import { NavLink, NavIcon } from "@/components/NavProgress";
import { cn } from "@/lib/utils";

const left = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/transfer", label: "Enviar", icon: ArrowLeftRight },
  { href: "/cards", label: "Tarjeta", icon: CreditCard },
];

const right = [
  { href: "/bills", label: "Pagar", icon: Receipt },
  { href: "/notifications", label: "Avisos", icon: Bell },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

export function BottomNav({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  const scanActive = pathname === "/scan";

  const renderItem = ({
    href,
    label,
    icon: Icon,
  }: (typeof left)[number]) => {
    const active = pathname === href;
    return (
      <NavLink
        key={href}
        href={href}
        className={cn(
          "relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition-colors min-[380px]:text-[11px]",
          active ? "text-accent" : "text-ink/45 hover:text-ink/80",
        )}
      >
        <span className="relative">
          <NavIcon icon={Icon} className="h-5 w-5" />
          {href === "/notifications" && unread > 0 && (
            <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-onaccent">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </span>
        {label}
      </NavLink>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-raised2/70 bg-panel/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 py-1.5">
        {left.map(renderItem)}

        {/* Escanear QR de cobro: botón central, sobresale de la barra. */}
        <div className="flex w-[68px] shrink-0 justify-center">
          <NavLink
            href="/scan"
            aria-label="Escanear QR de cobro"
            title="Escanear QR"
            className={cn(
              "-mt-6 grid h-14 w-14 place-items-center rounded-full border-4 border-canvas bg-accent text-onaccent shadow-glow transition-transform active:scale-95",
              scanActive && "ring-2 ring-accent/60 ring-offset-2 ring-offset-canvas",
            )}
          >
            <NavIcon icon={ScanQrCode} className="h-6 w-6" />
          </NavLink>
        </div>

        {right.map(renderItem)}
      </div>
    </nav>
  );
}
