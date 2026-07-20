import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) {
    // Verificamos que el usuario de la sesión aún exista (evita loops de
    // redirección si la cuenta fue borrada o la base cambió).
    const exists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });
    if (exists) {
      redirect(session.user.role === "ADMIN" ? "/admin" : "/dashboard");
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo size="lg" />
          <p className="text-balance text-sm text-ink/50">
            Tu billetera educativa. Aprendé a manejar tu dinero en un entorno
            simulado y seguro.
          </p>
        </div>

        <LoginForm />

        <p className="mt-6 text-center text-xs text-ink/30">
          Dinero ficticio · Solo con fines educativos
        </p>
      </div>
    </main>
  );
}
