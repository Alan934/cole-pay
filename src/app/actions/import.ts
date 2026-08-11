"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readSheet } from "read-excel-file/node";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import {
  parseStudentsSheet,
  ImportParseError,
  type ParsedRow,
  type SheetGrid,
} from "@/lib/import-students";
import { generateAlias, generateCvu } from "@/lib/utils";

/** Tope defensivo: una lista de curso pesa unos pocos KB. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Fila tal como viaja al cliente (sin datos que no se muestren). */
export type ImportRow = Pick<
  ParsedRow,
  "rowNumber" | "name" | "rawName" | "email" | "dni" | "cuit" | "errors" | "warnings"
>;

/** Previsualización: todavía no se creó nada. */
export type ImportPreview = {
  kind: "preview";
  groupId: string;
  groupName: string;
  fileName: string;
  valid: ImportRow[];
  invalid: ImportRow[];
};

/** Importación efectuada. `credentials` es la lista para repartir en clase. */
export type ImportDone = {
  kind: "done";
  groupName: string;
  created: number;
  skipped: number;
  credentials: { name: string; email: string; password: string }[];
  invalid: ImportRow[];
};

export type ImportFail = { kind: "error"; error: string };

export type ImportState = ImportPreview | ImportDone | ImportFail;

function fail(error: string): ImportFail {
  return { kind: "error", error };
}

/**
 * Lee la planilla y devuelve las filas ya normalizadas, marcando contra la
 * base lo que chocaría con un email / DNI / CUIT existente.
 */
async function readAndParse(file: File) {
  if (!file || file.size === 0) return fail("Elegí un archivo .xlsx.");
  if (file.size > MAX_FILE_BYTES)
    return fail("El archivo es demasiado grande (máximo 2 MB).");
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return fail(
      "El formato tiene que ser .xlsx. Si tenés un .xls o un .csv, abrilo en Excel y usá “Guardar como → Libro de Excel (.xlsx)”.",
    );
  }

  // Todo lo ya cargado, para no chocar contra los índices únicos de User.
  const users = await prisma.user.findMany({
    select: { email: true, dni: true, cuit: true },
  });
  const existing = {
    emails: new Set(users.map((u) => u.email.toLowerCase())),
    dnis: new Set(users.flatMap((u) => (u.dni ? [u.dni] : []))),
    cuits: new Set(users.flatMap((u) => (u.cuit ? [u.cuit] : []))),
  };

  let grid: SheetGrid;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    grid = (await readSheet(buffer, 1)) as unknown as SheetGrid;
  } catch {
    return fail(
      "No se pudo leer el archivo. Verificá que sea un .xlsx válido y que no esté abierto en Excel.",
    );
  }

  try {
    return parseStudentsSheet(grid, existing);
  } catch (e) {
    if (e instanceof ImportParseError) return fail(e.message);
    return fail("No se pudo interpretar la planilla.");
  }
}

/** Genera un alias libre; el campo es único en la base. */
function uniqueAlias(seed: string, taken: Set<string>): string {
  for (let i = 0; i < 50; i++) {
    const alias = generateAlias(seed);
    if (!taken.has(alias)) {
      taken.add(alias);
      return alias;
    }
  }
  // Fallback determinista: agota la aleatoriedad, no la paciencia.
  let n = 2;
  let alias = `${generateAlias(seed)}.${n}`;
  while (taken.has(alias)) alias = `${generateAlias(seed)}.${++n}`;
  taken.add(alias);
  return alias;
}

function uniqueCvu(taken: Set<string>): string {
  let cvu = generateCvu();
  while (taken.has(cvu)) cvu = generateCvu();
  taken.add(cvu);
  return cvu;
}

/**
 * Importación de alumnos desde Excel, en dos pasos sobre el mismo formulario.
 *
 * `mode=preview` sólo muestra qué se va a crear; `mode=confirm` escribe. En
 * los dos casos se vuelve a leer el archivo y a revalidar todo contra la base,
 * así que la confirmación nunca confía en lo que devolvió la previsualización.
 */
export async function importStudents(
  _prev: ImportState | null,
  formData: FormData,
): Promise<ImportState> {
  await requireAdminSession();

  const mode = String(formData.get("mode") || "preview");
  const groupId = String(formData.get("groupId") || "");
  if (!groupId || groupId === "__none__")
    return fail("Elegí el curso al que van a quedar asociados los alumnos.");

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group)
    return fail("Ese curso ya no existe. Actualizá la página y elegí otro.");

  const file = formData.get("file");
  if (!(file instanceof File)) return fail("Elegí un archivo .xlsx.");

  // El botón de confirmar viaja con el curso y el archivo que se mostraron en
  // la previsualización. Si cambiaron, se importaría algo distinto de lo que
  // la profe revisó, así que se corta acá.
  if (mode === "confirm") {
    const previewGroupId = String(formData.get("previewGroupId") || "");
    const previewFileName = String(formData.get("previewFileName") || "");
    if (previewGroupId !== groupId)
      return fail(
        "Cambiaste el curso después de previsualizar. Previsualizá de nuevo antes de crear.",
      );
    if (previewFileName !== file.name)
      return fail(
        "Cambiaste el archivo después de previsualizar. Previsualizá de nuevo antes de crear.",
      );
  }

  const parsed = await readAndParse(file);
  if ("kind" in parsed) return parsed; // error de lectura

  const { valid, invalid } = parsed;

  if (mode !== "confirm") {
    if (valid.length === 0 && invalid.length === 0)
      return fail(
        "La planilla no tiene filas de alumnos debajo del encabezado.",
      );
    return {
      kind: "preview",
      groupId,
      groupName: group.name,
      fileName: file.name,
      valid,
      invalid,
    };
  }

  if (valid.length === 0)
    return fail("No hay ninguna fila que se pueda importar.");

  // El hash de bcrypt es caro (~70 ms cada uno): se hace antes de abrir la
  // transacción para no tenerla esperando por CPU.
  const passwordHashes = await Promise.all(
    valid.map((r) => bcrypt.hash(r.dni, 10)),
  );

  const wallets = await prisma.wallet.findMany({
    select: { alias: true, cvu: true },
  });
  const takenAliases = new Set(wallets.map((w) => w.alias));
  const takenCvus = new Set(wallets.map((w) => w.cvu));

  const toCreate = valid.map((row, i) => ({
    name: row.name,
    email: row.email,
    dni: row.dni,
    cuit: row.cuit,
    passwordHash: passwordHashes[i],
    alias: uniqueAlias(row.name, takenAliases),
    cvu: uniqueCvu(takenCvus),
  }));

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const u of toCreate) {
          await tx.user.create({
            data: {
              name: u.name,
              email: u.email,
              dni: u.dni,
              cuit: u.cuit,
              passwordHash: u.passwordHash,
              role: "STUDENT",
              groupId,
              wallet: {
                create: { cvu: u.cvu, alias: u.alias, balance: 0 },
              },
            },
          });
        }
      },
      { timeout: 60_000, maxWait: 15_000 },
    );
  } catch (e) {
    // Si algo choca contra un índice único (alguien creó al alumno mientras
    // se miraba la previsualización), la transacción entera se revierte.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return fail(
        "Un alumno de la lista ya existe en el sistema. No se creó ninguno: volvé a subir el archivo para ver la lista actualizada.",
      );
    }
    return fail("No se pudo completar la importación. No se creó ningún alumno.");
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin/groups");
  revalidatePath("/admin");

  return {
    kind: "done",
    groupName: group.name,
    created: toCreate.length,
    skipped: invalid.length,
    credentials: valid.map((r) => ({
      name: r.name,
      email: r.email,
      password: r.dni,
    })),
    invalid,
  };
}
