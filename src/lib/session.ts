import { cache } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

/**
 * Todos los helpers están memoizados con `cache()`: dentro de un mismo render
 * el layout y la página comparten la misma sesión y la misma consulta, en vez
 * de ir dos veces a la base.
 */

/** Devuelve la sesión o redirige a /login. */
export const requireSession = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
});

/**
 * Chequeo de rol ADMIN sin tocar la base: el rol y el nombre ya vienen
 * firmados en el JWT. Usalo cuando no necesites la wallet del admin.
 */
export const requireAdminSession = cache(async () => {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") redirect(homeFor(session.user.role));
  return session.user;
});

/**
 * Puerta del área /admin. Es más ancha que `requireAdminSession` porque la
 * profe de quinto entra al mismo panel, pero sólo a las secciones de bancos y
 * tarjetas: cada página adentro vuelve a exigir el rol que le corresponde.
 */
export const requireAdminAreaSession = cache(async () => {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "BANK_ADMIN") redirect(homeFor(role));
  return session.user;
});

/** Ídem para STUDENT: sólo valida el rol, sin consulta. */
export const requireStudentSession = cache(async () => {
  const session = await requireSession();
  if (session.user.role !== "STUDENT") redirect(homeFor(session.user.role));
  return session.user;
});

/**
 * Pantalla de inicio de cada rol. La usan el login, la raíz y las
 * redirecciones cuando alguien cae en un área que no le corresponde.
 */
export function homeFor(role?: string | null): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "BANK_ADMIN":
      return "/admin/banks";
    case "BANK_EMPLOYEE":
      return "/bank";
    default:
      return "/dashboard";
  }
}

/**
 * Profe de quinto (o el admin general): puede administrar bancos, alumnos de
 * quinto y supervisar todas las tarjetas.
 */
export const requireBankAdminSession = cache(async () => {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "BANK_ADMIN" && role !== "ADMIN") redirect(homeFor(role));
  return session.user;
});

/**
 * Cualquiera que atienda el mostrador: empleado del banco, la profe de quinto
 * o el admin general.
 */
export const requireBankStaffSession = cache(async () => {
  const session = await requireSession();
  const role = session.user.role;
  if (role !== "BANK_EMPLOYEE" && role !== "BANK_ADMIN" && role !== "ADMIN") {
    redirect(homeFor(role));
  }
  return session.user;
});

/**
 * Empleado del banco con su banco cargado. La profe y el admin también entran,
 * pero pueden no tener un banco asignado: en ese caso `bank` viene en `null` y
 * la pantalla les ofrece elegir uno.
 */
export const requireBankStaff = cache(async () => {
  const me = await requireBankStaffSession();
  const user = await prisma.user.findUnique({
    where: { id: me.id },
    include: { bank: { include: { account: { include: { wallet: true } } } } },
  });
  if (!user) redirect("/login");
  return user;
});

/** Exige rol STUDENT; devuelve el usuario con su wallet y grupo. */
export const requireStudent = cache(async () => {
  const me = await requireStudentSession();
  const user = await prisma.user.findUnique({
    where: { id: me.id },
    include: { wallet: true, group: true },
  });
  if (!user) redirect("/login");
  return user;
});

/** Exige rol ADMIN; devuelve el usuario con su wallet. */
export const requireAdmin = cache(async () => {
  const me = await requireAdminSession();
  const user = await prisma.user.findUnique({
    where: { id: me.id },
    include: { wallet: true },
  });
  if (!user) redirect("/login");
  return user;
});
