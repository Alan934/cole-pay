import Link from "next/link";
import { Landmark } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";

/**
 * Aviso para el alumno que todavía no es cliente de ningún banco (o de ninguno
 * que le sirva para lo que quiere hacer): le explica el camino en vez de
 * mostrarle un formulario que el servidor le va a rechazar.
 */
export function NoBankNotice({ what }: { what: string }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-warning/15 text-warning">
        <Landmark className="h-7 w-7" />
      </div>
      <div>
        <CardTitle className="text-base text-ink">
          Primero tenés que ser cliente de un banco
        </CardTitle>
        <p className="mt-1 text-sm text-ink/55">
          Para {what} necesitás estar adherido a un banco. Pasá por el
          mostrador y los chicos de quinto te dan de alta.
        </p>
      </div>
      <Link
        href="/my-banks"
        className="text-sm font-medium text-accent hover:underline"
      >
        Ver mis bancos
      </Link>
    </Card>
  );
}
