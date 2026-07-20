"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

export type LoginState = { error: string } | null;

/** Inicia sesión con credenciales y redirige según el rol real del usuario. */
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") || "").toLowerCase();
  const password = String(formData.get("password") || "");

  // Determinamos el destino según el rol guardado en la base.
  const user = await prisma.user.findUnique({
    where: { email },
    select: { role: true },
  });
  const redirectTo = user?.role === "ADMIN" ? "/admin" : "/dashboard";

  try {
    await signIn("credentials", { email, password, redirectTo });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email o contraseña incorrectos." };
    }
    // signIn lanza NEXT_REDIRECT en el éxito; hay que re-lanzarlo.
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
