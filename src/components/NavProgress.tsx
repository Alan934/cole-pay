"use client";

import Link, { useLinkStatus } from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Feedback de navegación. Las páginas son server components que consultan la
 * base, así que entre el clic y el render hay un ida y vuelta al servidor: sin
 * esto la UI queda congelada y parece que no pasó nada.
 */

type Ctx = { pending: boolean; setPending: (id: string, on: boolean) => void };

const NavProgressCtx = createContext<Ctx>({
  pending: false,
  setPending: () => {},
});

export function NavProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Lista de links en vuelo: puede haber más de uno si el usuario clickea rápido.
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const setPending = useCallback((id: string, on: boolean) => {
    setPendingIds((prev) => {
      const has = prev.includes(id);
      if (on === has) return prev;
      return on ? [...prev, id] : prev.filter((p) => p !== id);
    });
  }, []);

  const value = useMemo(
    () => ({ pending: pendingIds.length > 0, setPending }),
    [pendingIds.length, setPending],
  );

  return (
    <NavProgressCtx.Provider value={value}>
      <TopProgressBar />
      {children}
    </NavProgressCtx.Provider>
  );
}

/** Barra fina arriba de todo mientras se resuelve la navegación. */
function TopProgressBar() {
  const { pending } = useContext(NavProgressCtx);
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden transition-opacity duration-200",
        pending ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="h-full w-2/5 animate-progress bg-accent shadow-glow" />
    </div>
  );
}

/**
 * Link con dos mejoras sobre `<Link>`:
 *
 * 1. Avisa cuándo está navegando (`useLinkStatus` sólo funciona dentro de un
 *    `<Link>`, por eso el reporte vive en un hijo).
 * 2. Precarga los datos reales recién cuando el usuario apunta al link. Con el
 *    prefetch por defecto sólo se trae el esqueleto (`loading.tsx`), que es
 *    estático y gratis; el `prefetch` completo de los 8 items del menú
 *    ejecutaría las consultas de todas las rutas en cada carga de página.
 */
export function NavLink({
  href,
  children,
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: React.ComponentProps<typeof Link> & { href: string }) {
  const [warm, setWarm] = useState(false);
  const warmUp = useCallback(() => setWarm(true), []);

  return (
    <Link
      href={href}
      prefetch={warm ? true : undefined}
      onMouseEnter={(e) => {
        warmUp();
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        warmUp();
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        warmUp();
        onTouchStart?.(e);
      }}
      {...props}
    >
      <PendingReporter id={href} />
      {children}
    </Link>
  );
}

function PendingReporter({ id }: { id: string }) {
  const { pending } = useLinkStatus();
  const { setPending } = useContext(NavProgressCtx);

  useEffect(() => {
    setPending(id, pending);
    return () => setPending(id, false);
  }, [id, pending, setPending]);

  return null;
}

/**
 * Ícono del link que se convierte en spinner mientras esa ruta carga.
 * Debe usarse dentro de un `<Link>`/`<NavLink>`.
 */
export function NavIcon({
  icon: Icon,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const { pending } = useLinkStatus();
  if (pending) {
    return (
      <span
        aria-label="Cargando"
        className={cn(
          "inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent",
          className,
        )}
      />
    );
  }
  return <Icon className={className} />;
}
