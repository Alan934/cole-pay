"use client";

import { useMemo, useState } from "react";
import { FolderKanban, Users, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/utils";

export type GroupCard = {
  id: string;
  name: string;
  members: number;
  total: number;
};

export function GroupsList({ groups }: { groups: GroupCard[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, query]);

  return (
    <div className="flex flex-col gap-3">
      {groups.length > 0 && (
        <div className="relative sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar grupo…"
            className="pl-9"
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <Card className="text-center text-sm text-ink/40">
            {groups.length === 0 ? "Todavía no hay grupos." : "Sin resultados."}
          </Card>
        ) : (
          filtered.map((g) => (
            <Card key={g.id}>
              <div className="mb-2 flex items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet/15 text-violet">
                  <FolderKanban className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{g.name}</p>
                  <p className="flex items-center gap-1 text-xs text-ink/40">
                    <Users className="h-3 w-3" />
                    {g.members} miembro(s)
                  </p>
                </div>
              </div>
              <p className="text-xs text-ink/40">Saldo total del grupo</p>
              <p className="text-lg font-bold text-accent">
                {formatMoney(g.total)}
              </p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
