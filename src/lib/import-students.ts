/**
 * Importación masiva de alumnos desde una planilla de Excel.
 *
 * La planilla que usa la profe viene de la escuela, así que no se puede
 * asumir nada: el encabezado no está en la primera fila, los nombres vienen
 * en MAYÚSCULAS y con el formato "APELLIDO, NOMBRES", el CUIT trae guiones y
 * alguna celda puede tener un `#VALUE!` de una fórmula rota.
 *
 * Este módulo no toca la base: convierte la grilla cruda en filas normalizadas
 * con sus errores y avisos, para poder mostrarle una previsualización a la
 * profe antes de crear nada.
 */

/** Grilla cruda tal como la devuelve el lector de Excel. */
export type SheetGrid = (string | number | boolean | Date | null)[][];

/** Aviso: la fila se importa igual, pero hay algo que conviene mirar. */
export type RowWarning = "DNI_DEDUCIDO" | "CUIT_INVALIDO" | "NOMBRE_SIN_COMA";

/** Motivo por el que una fila no se puede importar. */
export type RowError =
  | "SIN_NOMBRE"
  | "SIN_EMAIL"
  | "EMAIL_INVALIDO"
  | "SIN_DNI"
  | "DNI_INVALIDO"
  | "EMAIL_REPETIDO"
  | "DNI_REPETIDO"
  | "CUIT_REPETIDO";

export type ParsedRow = {
  /** Fila real de la planilla (1-based), para que la profe la ubique. */
  rowNumber: number;
  /** Nombre normalizado: "Leonel Giovanni Angelini". */
  name: string;
  /** Nombre tal cual venía en la celda, para mostrarlo en la previsualización. */
  rawName: string;
  email: string;
  dni: string;
  cuit: string | null;
  errors: RowError[];
  warnings: RowWarning[];
};

export type ParseResult = {
  /** Filas que se pueden importar (sin errores). */
  valid: ParsedRow[];
  /** Filas descartadas, con el motivo. */
  invalid: ParsedRow[];
  /** Número de la fila del encabezado en la planilla. */
  headerRow: number;
};

export class ImportParseError extends Error {}

/* --------------------------- Texto y encabezados -------------------------- */

/** Minúsculas, sin acentos y sin espacios de más: para comparar encabezados. */
function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // acentos ya separados por NFD
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Nombres aceptados para cada columna. La planilla de la escuela usa los
 * primeros, el resto son variantes razonables por si cambia el formato.
 */
const COLUMN_ALIASES = {
  name: [
    "apellidos y nombres",
    "apellido y nombre",
    "apellidos y nombre",
    "apellido y nombres",
    "nombre y apellido",
    "nombre completo",
    "alumno",
    "alumno/a",
    "nombre",
  ],
  email: [
    "correo personal",
    "correo electronico",
    "correo",
    "email",
    "e-mail",
    "mail",
  ],
  dni: ["dni", "documento", "nro documento", "n documento", "num documento"],
  cuit: ["cuit", "cuil", "cuit/cuil", "cuil/cuit"],
} as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;

/** Índice de columna de cada dato, según el encabezado encontrado. */
type ColumnMap = Record<ColumnKey, number | null>;

function matchColumn(header: string): ColumnKey | null {
  for (const key of Object.keys(COLUMN_ALIASES) as ColumnKey[]) {
    if ((COLUMN_ALIASES[key] as readonly string[]).includes(header)) return key;
  }
  return null;
}

/**
 * Busca la fila del encabezado. No siempre es la primera: la planilla real
 * arranca en la fila 4 con celdas vacías arriba. Se considera encabezado la
 * primera fila donde aparezcan a la vez la columna del nombre y la del email.
 */
function findHeader(
  grid: SheetGrid,
): { rowIndex: number; columns: ColumnMap } | null {
  const limit = Math.min(grid.length, 30);
  for (let i = 0; i < limit; i++) {
    const columns: ColumnMap = { name: null, email: null, dni: null, cuit: null };
    grid[i].forEach((cell, colIndex) => {
      const key = matchColumn(normalizeHeader(cell));
      // El primer match gana: si la planilla repite un encabezado, nos
      // quedamos con la columna de más a la izquierda.
      if (key && columns[key] === null) columns[key] = colIndex;
    });
    if (columns.name !== null && columns.email !== null) {
      return { rowIndex: i, columns };
    }
  }
  return null;
}

/* ------------------------------ Normalización ----------------------------- */

/** Partículas que en castellano van en minúscula dentro de un apellido. */
const LOWERCASE_PARTICLES = new Set([
  "de",
  "del",
  "la",
  "las",
  "lo",
  "los",
  "y",
  "e",
]);

/** "MARTÍN" -> "Martín", respetando guiones y partículas ("de la Fuente"). */
function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((token, index) => {
      if (!/[a-záéíóúüñ]/i.test(token)) return token; // separador
      if (index > 0 && LOWERCASE_PARTICLES.has(token)) return token;
      return token.charAt(0).toUpperCase() + token.slice(1);
    })
    .join("");
}

/**
 * "ANGELINI, LEONEL GIOVANNI" -> "Leonel Giovanni Angelini".
 *
 * La planilla lista a los alumnos por apellido para poder ordenarlos, pero en
 * la app el alumno se ve a sí mismo, así que va el nombre primero.
 */
export function normalizeStudentName(raw: string): {
  name: string;
  hadComma: boolean;
} {
  const clean = String(raw ?? "").replace(/\s+/g, " ").trim();
  const comma = clean.indexOf(",");
  if (comma === -1) return { name: toTitleCase(clean), hadComma: false };

  const surnames = clean.slice(0, comma).trim();
  const givenNames = clean.slice(comma + 1).trim();
  if (!givenNames) return { name: toTitleCase(surnames), hadComma: true };
  return { name: toTitleCase(`${givenNames} ${surnames}`), hadComma: true };
}

/** Deja solo dígitos. Sirve tanto para el DNI como para el CUIT con guiones. */
function digitsOf(value: unknown): string {
  if (value === null || value === undefined) return "";
  // Excel puede devolver el DNI como número; `String` alcanza para ambos casos.
  return String(value).replace(/\D/g, "");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* -------------------------------- Parseo --------------------------------- */

/**
 * Convierte la grilla cruda en filas normalizadas.
 *
 * `existing` son los datos ya cargados en la base, para marcar de antemano lo
 * que chocaría contra un índice único.
 */
export function parseStudentsSheet(
  grid: SheetGrid,
  existing?: { emails?: Set<string>; dnis?: Set<string>; cuits?: Set<string> },
): ParseResult {
  const header = findHeader(grid);
  if (!header) {
    throw new ImportParseError(
      "No se encontró el encabezado. La planilla necesita una columna de nombre (ej: “Apellidos y Nombres”) y otra de correo.",
    );
  }

  const { columns } = header;
  const rows: ParsedRow[] = [];

  // Se acumulan a medida que se recorre para detectar repetidos dentro del
  // mismo archivo, no solo contra la base.
  const seenEmails = new Set(existing?.emails ?? []);
  const seenDnis = new Set(existing?.dnis ?? []);
  const seenCuits = new Set(existing?.cuits ?? []);

  for (let i = header.rowIndex + 1; i < grid.length; i++) {
    const row = grid[i] ?? [];
    const cell = (index: number | null) =>
      index === null ? null : (row[index] ?? null);

    const rawName = String(cell(columns.name) ?? "").replace(/\s+/g, " ").trim();
    const rawEmail = String(cell(columns.email) ?? "").trim().toLowerCase();

    // Fila completamente vacía: fin de la lista o separador, se ignora en silencio.
    if (!rawName && !rawEmail && !digitsOf(cell(columns.dni))) continue;

    const errors: RowError[] = [];
    const warnings: RowWarning[] = [];

    const { name, hadComma } = normalizeStudentName(rawName);
    if (!name) errors.push("SIN_NOMBRE");
    else if (!hadComma) warnings.push("NOMBRE_SIN_COMA");

    if (!rawEmail) errors.push("SIN_EMAIL");
    else if (!EMAIL_RE.test(rawEmail)) errors.push("EMAIL_INVALIDO");

    // CUIT: 11 dígitos. Si la celda trae basura (#VALUE! de una fórmula rota)
    // no se frena la importación, se importa sin CUIT y se avisa.
    const rawCuit = digitsOf(cell(columns.cuit));
    let cuit: string | null = null;
    if (rawCuit.length === 11) cuit = rawCuit;
    else if (rawCuit.length > 0) warnings.push("CUIT_INVALIDO");

    // DNI: es la contraseña inicial del alumno, así que es obligatorio.
    // Si falta pero hay CUIT válido, se deduce (los 8 dígitos del medio).
    let dni = digitsOf(cell(columns.dni));
    if (!dni && cuit) {
      dni = cuit.slice(2, 10).replace(/^0+/, "");
      warnings.push("DNI_DEDUCIDO");
    }
    if (!dni) errors.push("SIN_DNI");
    else if (!/^\d{7,9}$/.test(dni)) errors.push("DNI_INVALIDO");

    // Repetidos: contra la base y contra las filas ya leídas del archivo.
    if (rawEmail && seenEmails.has(rawEmail)) errors.push("EMAIL_REPETIDO");
    if (dni && /^\d{7,9}$/.test(dni) && seenDnis.has(dni))
      errors.push("DNI_REPETIDO");
    if (cuit && seenCuits.has(cuit)) errors.push("CUIT_REPETIDO");

    if (errors.length === 0) {
      seenEmails.add(rawEmail);
      seenDnis.add(dni);
      if (cuit) seenCuits.add(cuit);
    }

    rows.push({
      rowNumber: i + 1, // las filas de Excel se cuentan desde 1
      name,
      rawName,
      email: rawEmail,
      dni,
      cuit,
      errors,
      warnings,
    });
  }

  return {
    valid: rows.filter((r) => r.errors.length === 0),
    invalid: rows.filter((r) => r.errors.length > 0),
    headerRow: header.rowIndex + 1,
  };
}

/* ------------------------------- Mensajes -------------------------------- */

const ERROR_TEXT: Record<RowError, string> = {
  SIN_NOMBRE: "Falta el nombre",
  SIN_EMAIL: "Falta el correo",
  EMAIL_INVALIDO: "El correo no es válido",
  SIN_DNI: "Falta el DNI (es la contraseña del alumno)",
  DNI_INVALIDO: "El DNI debe tener entre 7 y 9 dígitos",
  EMAIL_REPETIDO: "Ese correo ya está en uso",
  DNI_REPETIDO: "Ese DNI ya está en uso",
  CUIT_REPETIDO: "Ese CUIT ya está en uso",
};

const WARNING_TEXT: Record<RowWarning, string> = {
  DNI_DEDUCIDO: "DNI deducido del CUIT",
  CUIT_INVALIDO: "CUIT ilegible: se importa sin CUIT",
  NOMBRE_SIN_COMA: "Nombre sin coma: no se pudo separar apellido de nombre",
};

export function errorText(code: RowError): string {
  return ERROR_TEXT[code];
}

export function warningText(code: RowWarning): string {
  return WARNING_TEXT[code];
}
