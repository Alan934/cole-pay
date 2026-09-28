import type { NextAuthConfig } from "next-auth";
import { SESSION_IDLE_MINUTES } from "@/lib/session-timeout";

/**
 * Configuración base compatible con el runtime "edge" del middleware.
 * No incluye el provider de credenciales (que usa Prisma/bcrypt) para
 * mantener el middleware liviano; ese se agrega en `auth.ts`.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt", maxAge: SESSION_IDLE_MINUTES * 60 },
  callbacks: {
    // Propaga role e id del usuario al token y a la sesión.
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
    // Control de acceso por ruta.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role;
      const path = nextUrl.pathname;

      const isAdminArea = path.startsWith("/admin");
      // Secciones del panel que también maneja la profe de quinto: los bancos,
      // las tarjetas y la lista de alumnos (donde ve sólo los de quinto).
      const isBankAdminArea =
        path.startsWith("/admin/banks") ||
        path.startsWith("/admin/cards") ||
        path.startsWith("/admin/students");
      const isBankArea = path.startsWith("/bank");
      const isStudentArea =
        path.startsWith("/dashboard") ||
        path.startsWith("/transfer") ||
        path.startsWith("/bills") ||
        path.startsWith("/activity") ||
        path.startsWith("/settings") ||
        path.startsWith("/notifications") ||
        path.startsWith("/goals") ||
        path.startsWith("/deposits") ||
        path.startsWith("/cards") ||
        path.startsWith("/loans") ||
        path.startsWith("/request") ||
        path.startsWith("/rendimientos");

      if (isAdminArea) {
        if (isBankAdminArea) {
          return isLoggedIn && (role === "ADMIN" || role === "BANK_ADMIN");
        }
        return isLoggedIn && role === "ADMIN";
      }
      if (isBankArea) {
        return (
          isLoggedIn &&
          (role === "BANK_EMPLOYEE" || role === "BANK_ADMIN" || role === "ADMIN")
        );
      }
      if (isStudentArea) {
        return isLoggedIn;
      }
      return true;
    },
  },
  providers: [], // se completan en auth.ts
} satisfies NextAuthConfig;
