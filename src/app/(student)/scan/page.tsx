import { requireStudentSession } from "@/lib/session";
import { Scanner } from "./Scanner";

export default async function ScanPage() {
  await requireStudentSession();

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Escanear QR</h1>
        <p className="text-sm text-ink/50">
          Escaneá el QR de quien te cobra para pagarle con tu cuenta.
        </p>
      </div>
      <Scanner />
    </div>
  );
}
