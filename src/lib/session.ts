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
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  return session.user;
});

/** Ídem para STUDENT: sólo valida el rol, sin consulta. */
export const requireStudentSession = cache(async () => {
  const session = await requireSession();
  if (session.user.role !== "STUDENT") redirect("/admin");
  return session.user;
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
