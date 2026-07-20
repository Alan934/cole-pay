import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

/** Devuelve la sesión o redirige a /login. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

/** Exige rol STUDENT; devuelve el usuario con su wallet. */
export async function requireStudent() {
  const session = await requireSession();
  if (session.user.role !== "STUDENT") redirect("/admin");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { wallet: true, group: true },
  });
  if (!user) redirect("/login");
  return user;
}

/** Exige rol ADMIN; devuelve el usuario con su wallet. */
export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { wallet: true },
  });
  if (!user) redirect("/login");
  return user;
}
