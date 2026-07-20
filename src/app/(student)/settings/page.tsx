import { requireStudent } from "@/lib/session";
import { Card, CardTitle } from "@/components/ui/Card";
import { LogoutButton } from "@/components/LogoutButton";
import { AliasForm } from "./AliasForm";

export default async function SettingsPage() {
  const me = await requireStudent();

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold">Ajustes</h1>
        <p className="text-sm text-ink/50">Tu cuenta en ColePay.</p>
      </div>

      <Card>
        <CardTitle className="mb-3">Perfil</CardTitle>
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-accent/15 text-lg font-bold text-accent">
            {me.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold">{me.name}</p>
            <p className="text-sm text-ink/50">{me.email}</p>
            {me.group && (
              <p className="text-xs text-ink/40">Grupo: {me.group.name}</p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-3">Cambiar alias</CardTitle>
        <AliasForm currentAlias={me.wallet?.alias ?? ""} />
      </Card>

      <Card>
        <CardTitle className="mb-1">Datos de la billetera</CardTitle>
        <p className="text-xs text-ink/40">CVU (no editable)</p>
        <p className="font-mono text-sm">{me.wallet?.cvu}</p>
      </Card>

      <Card className="flex items-center justify-between">
        <div>
          <CardTitle>Sesión</CardTitle>
          <p className="text-xs text-ink/40">Cerrá sesión en este dispositivo.</p>
        </div>
        <LogoutButton className="inline-flex items-center gap-2 rounded-xl border border-raised3 px-4 py-2 text-sm text-ink/80 hover:bg-raised" />
      </Card>
    </div>
  );
}
