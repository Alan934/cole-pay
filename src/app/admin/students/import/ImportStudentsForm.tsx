"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  Info,
  Upload,
  Users,
} from "lucide-react";
import {
  importStudents,
  type ImportRow,
  type ImportState,
} from "@/app/actions/import";
import { Card, CardTitle } from "@/components/ui/Card";
import { Label } from "@/components/ui/Input";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FormFeedback } from "@/components/admin/FormFeedback";
import { buildCsv } from "@/lib/csv";
import { errorText, warningText } from "@/lib/import-students";
import { formatCuit, formatDni } from "@/lib/identity";

export type GroupOpt = { id: string; name: string };

/**
 * No hay `<form action={...}>` acá a propósito.
 *
 * React resetea los campos no controlados apenas termina una server action, y
 * la importación necesita dos envíos seguidos (previsualizar y confirmar) con
 * el mismo archivo: tras el primero el `<input type="file">` quedaba vacío y
 * la confirmación se iba sin planilla. El archivo y el curso viven en estado
 * de React y el FormData se arma a mano en cada envío.
 */
export function ImportStudentsForm({ groups }: { groups: GroupOpt[] }) {
  const [state, formAction, pending] = useActionState<
    ImportState | null,
    FormData
  >(importStudents, null);

  const [groupId, setGroupId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Terminada la importación el archivo ya no sirve: si quedara cargado, un
  // segundo clic intentaría crear a los mismos alumnos de nuevo.
  useEffect(() => {
    if (state?.kind === "done") {
      setFile(null);
      setGroupId("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [state]);

  const groupOptions = useMemo(
    () => groups.map((g) => ({ value: g.id, label: g.name })),
    [groups],
  );

  function submit(mode: "preview" | "confirm") {
    const fd = new FormData();
    fd.set("mode", mode);
    fd.set("groupId", groupId);
    if (file) fd.set("file", file);
    if (mode === "confirm" && state?.kind === "preview") {
      fd.set("previewGroupId", state.groupId);
      fd.set("previewFileName", state.fileName);
    }
    // Sin transición, `pending` no se actualiza y los botones no muestran que
    // están trabajando (ni se bloquean contra el doble clic).
    startTransition(() => formAction(fd));
  }

  const canPreview = groupId !== "" && file !== null && !pending;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-accent" />
          <CardTitle className="text-ink/80">Planilla de alumnos</CardTitle>
        </div>

        {groups.length === 0 ? (
          <FormFeedback
            ok={false}
            msg="Todavía no creaste ningún curso. Creá uno en Grupos antes de importar."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="i-group">Curso destino</Label>
              <SearchSelect
                id="i-group"
                name="groupId"
                options={groupOptions}
                defaultValue={groupId}
                onChange={setGroupId}
                placeholder="Elegí el curso…"
                searchPlaceholder="Buscar curso…"
                emptyMessage="No se encontró ningún curso."
              />
              <p className="mt-1.5 text-xs text-ink/40">
                Todos los alumnos del archivo quedan en este curso.
              </p>
            </div>

            <div>
              <Label htmlFor="i-file">Archivo .xlsx</Label>
              <label
                htmlFor="i-file"
                className="flex h-12 w-full cursor-pointer items-center gap-2 rounded-xl border border-dashed border-raised3 bg-panel/80 px-4 text-sm text-ink/60 transition-colors hover:border-accent/60 hover:text-ink"
              >
                <Upload className="h-4 w-4 shrink-0 text-accent" />
                <span className="truncate">
                  {file?.name || "Elegir planilla…"}
                </span>
              </label>
              <input
                ref={fileRef}
                id="i-file"
                type="file"
                accept=".xlsx"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1.5 text-xs text-ink/40">
                Hasta 2 MB. Se lee la primera hoja.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-raised2 bg-raised/40 px-3 py-2.5 text-xs text-ink/60">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" />
          <div className="space-y-1">
            <p>
              Se buscan las columnas{" "}
              <b className="text-ink/80">Apellidos y Nombres</b>,{" "}
              <b className="text-ink/80">Correo personal</b>,{" "}
              <b className="text-ink/80">DNI</b> y{" "}
              <b className="text-ink/80">CUIT</b>. No importa en qué fila
              empiece el encabezado ni el orden de las columnas.
            </p>
            <p>
              La contraseña inicial de cada alumno es su{" "}
              <b className="text-ink/80">DNI</b>, y entra con su correo
              personal. Conviene que la cambien desde Ajustes.
            </p>
          </div>
        </div>

        {groups.length > 0 && (
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              disabled={!canPreview}
              onClick={() => submit("preview")}
            >
              {pending ? "Leyendo planilla…" : "Previsualizar"}
            </Button>
          </div>
        )}

        {state?.kind === "error" && (
          <div className="mt-4">
            <FormFeedback ok={false} msg={state.error} />
          </div>
        )}
      </Card>

      {state?.kind === "preview" && (
        <PreviewPanel
          state={state}
          pending={pending}
          onConfirm={() => submit("confirm")}
        />
      )}

      {state?.kind === "done" && <DonePanel state={state} />}
    </div>
  );
}

/* ---------------------------- Previsualización ---------------------------- */

function PreviewPanel({
  state,
  pending,
  onConfirm,
}: {
  state: Extract<ImportState, { kind: "preview" }>;
  pending: boolean;
  onConfirm: () => void;
}) {
  const { valid, invalid, groupName, fileName } = state;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base text-ink/90">
            Previsualización
          </CardTitle>
          <p className="text-xs text-ink/40">
            {fileName} → curso <b className="text-ink/70">{groupName}</b>.
            Todavía no se creó nada.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="success">{valid.length} a crear</Badge>
          {invalid.length > 0 && (
            <Badge tone="warning">{invalid.length} se descartan</Badge>
          )}
        </div>
      </div>

      {valid.length > 0 && <ValidTable rows={valid} />}

      {invalid.length > 0 && <InvalidTable rows={invalid} />}

      <div className="flex justify-end">
        {valid.length === 0 ? (
          <p className="text-sm text-danger">
            Ninguna fila se puede importar. Corregí la planilla y volvé a
            subirla.
          </p>
        ) : (
          <Button type="button" disabled={pending} onClick={onConfirm}>
            {pending
              ? "Creando alumnos…"
              : `Crear ${valid.length} alumno${valid.length === 1 ? "" : "s"} en ${groupName}`}
          </Button>
        )}
      </div>
    </Card>
  );
}

function ValidTable({ rows }: { rows: ImportRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-raised2">
      <div className="max-h-[26rem] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 border-b border-raised bg-card text-left text-xs text-ink/50">
            <tr>
              <th className="px-3 py-2.5 font-medium">Fila</th>
              <th className="px-3 py-2.5 font-medium">Alumno</th>
              <th className="px-3 py-2.5 font-medium">Email (login)</th>
              <th className="px-3 py-2.5 font-medium">DNI / contraseña</th>
              <th className="px-3 py-2.5 font-medium">CUIT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-raised">
            {rows.map((r) => (
              <tr key={r.rowNumber} className="hover:bg-raised/40">
                <td className="px-3 py-2.5 text-xs text-ink/30">
                  {r.rowNumber}
                </td>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-ink/90">{r.name}</p>
                  <p className="text-xs text-ink/30">{r.rawName}</p>
                  {r.warnings.map((w) => (
                    <p
                      key={w}
                      className="mt-1 flex items-center gap-1 text-xs text-warning"
                    >
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {warningText(w)}
                    </p>
                  ))}
                </td>
                <td className="px-3 py-2.5 text-ink/70">{r.email}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-ink/70">
                  {formatDni(r.dni)}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-ink/40">
                  {r.cuit ? formatCuit(r.cuit) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvalidTable({ rows }: { rows: ImportRow[] }) {
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-warning">
        <AlertTriangle className="h-4 w-4" />
        Filas que se van a saltear ({rows.length})
      </p>
      <ul className="flex flex-col gap-1.5 text-sm">
        {rows.map((r) => (
          <li key={r.rowNumber} className="flex flex-wrap gap-x-2 text-ink/60">
            <span className="text-xs text-ink/30">Fila {r.rowNumber}</span>
            <span className="font-medium text-ink/80">
              {r.rawName || "(sin nombre)"}
            </span>
            <span className="text-warning">
              {r.errors.map(errorText).join(" · ")}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink/40">
        Podés cargarlas a mano desde Alumnos, o corregir la planilla y volver a
        importarla: los alumnos ya creados no se duplican.
      </p>
    </div>
  );
}

/* -------------------------------- Resultado ------------------------------- */

function DonePanel({
  state,
}: {
  state: Extract<ImportState, { kind: "done" }>;
}) {
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    await navigator.clipboard.writeText(
      [
        "Alumno\tEmail\tContraseña",
        ...state.credentials.map(
          (c) => `${c.name}\t${c.email}\t${c.password}`,
        ),
      ].join("\n"),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadCsv() {
    const csv = buildCsv(
      ["Alumno", "Email", "Contraseña"],
      state.credentials.map((c) => [c.name, c.email, c.password]),
    );

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `colepay-accesos-${state.groupName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="flex flex-col gap-4 border-accent/30">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <CardTitle className="text-base text-ink/90">
            Se crearon {state.created} alumno
            {state.created === 1 ? "" : "s"} en {state.groupName}
          </CardTitle>
          <p className="text-sm text-ink/50">
            Cada uno entra con su correo y su DNI como contraseña.
            {state.skipped > 0 &&
              ` Se saltearon ${state.skipped} fila(s) incompletas.`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={copyAll}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copiado" : "Copiar lista"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={downloadCsv}
        >
          <Download className="h-4 w-4" />
          Descargar CSV
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-raised2">
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-raised bg-card text-left text-xs text-ink/50">
              <tr>
                <th className="px-3 py-2.5 font-medium">Alumno</th>
                <th className="px-3 py-2.5 font-medium">Email</th>
                <th className="px-3 py-2.5 font-medium">Contraseña</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-raised">
              {state.credentials.map((c) => (
                <tr key={c.email}>
                  <td className="px-3 py-2.5 text-ink/80">{c.name}</td>
                  <td className="px-3 py-2.5 text-ink/60">{c.email}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-ink/70">
                    {c.password}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {state.invalid.length > 0 && <InvalidTable rows={state.invalid} />}
    </Card>
  );
}
