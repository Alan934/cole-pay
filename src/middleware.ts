import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// El middleware usa solo la config edge-safe (sin Prisma/bcrypt).
export default NextAuth(authConfig).auth;

export const config = {
  // Protege todo menos assets estáticos y la API de auth.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg).*)"],
};
