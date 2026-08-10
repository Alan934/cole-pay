import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export const SPENDING_CATEGORIES = [
  "General",
  "Comida",
  "Servicios",
  "Alquiler",
  "Entretenimiento",
  "Ahorro",
  "Otros",
] as const;

export const transferSchema = z.object({
  destination: z
    .string()
    .trim()
    .min(3, "Ingresá un CVU o alias válido"),
  amount: z.coerce
    .number({ invalid_type_error: "Monto inválido" })
    .positive("El monto debe ser mayor a 0")
    .max(9_999_999, "Monto demasiado alto"),
  description: z.string().trim().max(120, "Máximo 120 caracteres").optional(),
  category: z.string().trim().max(30).optional(),
});

// --- Metas de ahorro ---
export const createGoalSchema = z.object({
  name: z.string().trim().min(2, "Nombre muy corto").max(60),
  targetAmount: z.coerce.number().positive("Monto inválido").max(9_999_999),
});

export const goalMoveSchema = z.object({
  goalId: z.string().min(1),
  amount: z.coerce.number().positive("Monto inválido").max(9_999_999),
  direction: z.enum(["deposit", "withdraw"]),
});

// --- Plazo fijo ---
// El plazo válido se valida contra los DepositTerm activos de la base,
// porque el admin los define desde el panel.
export const createDepositSchema = z.object({
  principal: z.coerce.number().positive("Monto inválido").max(9_999_999),
  termDays: z.coerce.number().int().positive("Plazo inválido").max(3650),
});

// --- Rendimientos (admin) ---
const checkbox = z
  .union([z.string(), z.boolean(), z.null(), z.undefined()])
  .transform((v) => v === true || v === "on" || v === "true");

const tna = z.coerce
  .number({ invalid_type_error: "Tasa inválida" })
  .min(0, "La tasa no puede ser negativa")
  .max(9999, "Tasa demasiado alta");

export const bankSettingsSchema = z.object({
  interestEnabled: checkbox,
  balanceTnaPct: tna,
  goalsTnaPct: tna,
  goalsLockDays: z.coerce.number().int().min(0).max(365),
  minBalanceToEarn: z.coerce.number().min(0).max(9_999_999),
});

export const inflationSchema = z.object({
  inflationEnabled: checkbox,
  monthlyInflationPct: z.coerce
    .number({ invalid_type_error: "Inflación inválida" })
    .min(0, "No puede ser negativa")
    .max(500, "Demasiado alta"),
});

export const depositTermSchema = z.object({
  days: z.coerce
    .number()
    .int()
    .min(1, "Mínimo 1 día")
    .max(365, "Máximo 365 días"),
  tnaPct: tna,
});

export const forceAccrualSchema = z.object({
  days: z.coerce
    .number()
    .int()
    .min(1, "Mínimo 1 día")
    .max(366, "Máximo 366 días"),
});

export const quizAnswerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().trim().min(1, "Elegí una respuesta").max(60),
});

// --- Pedidos de cobro ---
export const paymentRequestSchema = z.object({
  amount: z.coerce.number().positive("Monto inválido").max(9_999_999),
  description: z.string().trim().max(120).optional(),
});

// --- Premios y multas (admin) ---
export const prizeFineSchema = z.object({
  studentId: z.string().min(1, "Seleccioná un alumno"),
  kind: z.enum(["PRIZE", "FINE"]),
  amount: z.coerce.number().positive("Monto inválido").max(9_999_999),
  reason: z.string().trim().min(2, "Indicá un motivo").max(120),
});

// --- Cobros recurrentes (admin) ---
export const recurringSchema = z.object({
  description: z.string().trim().min(2, "Descripción muy corta").max(120),
  amount: z.coerce.number().positive("Monto inválido").max(9_999_999),
  intervalDays: z.coerce.number().int().min(1).max(90),
  groupId: z.string().min(1, "Seleccioná un grupo"),
});

export const aliasSchema = z.object({
  alias: z
    .string()
    .trim()
    .toLowerCase()
    .min(4, "Mínimo 4 caracteres")
    .max(40, "Máximo 40 caracteres")
    .regex(/^[a-z0-9.\-_]+$/, "Solo letras, números y . - _"),
});

/** DNI argentino: solo dígitos, 7 u 8 (se acepta hasta 9 por las dudas). Opcional. */
const dniField = z
  .string()
  .trim()
  .regex(/^\d{7,9}$/, "DNI inválido: solo números (7 a 9 dígitos)")
  .optional();

/**
 * CUIT: 11 dígitos. Se puede escribir con o sin guiones (20-45123678-3) y se
 * guarda sin ellos. Opcional.
 */
const cuitField = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.-]/g, ""))
  .refine((v) => /^\d{11}$/.test(v), "CUIT inválido: deben ser 11 dígitos")
  .optional();

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Nombre demasiado corto"),
  email: z.string().email("Email inválido").toLowerCase(),
  dni: dniField,
  cuit: cuitField,
  password: z.string().min(4, "Mínimo 4 caracteres"),
  groupId: z.string().optional(),
  role: z.enum(["ADMIN", "STUDENT"]).default("STUDENT"),
});

export const editUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(2, "Nombre demasiado corto"),
  email: z.string().email("Email inválido").toLowerCase(),
  dni: dniField,
  cuit: cuitField,
  groupId: z.string().optional(),
  password: z.string().optional(),
});

export const groupSchema = z.object({
  name: z.string().trim().min(2, "Nombre demasiado corto").max(40),
});

export const issuanceSchema = z.object({
  amount: z.coerce.number().positive("Monto inválido").max(99_999_999),
});

export const depositSchema = z.object({
  studentId: z.string().min(1, "Seleccioná un alumno"),
  amount: z.coerce.number().positive("Monto inválido").max(9_999_999),
  description: z.string().trim().max(120).optional(),
});

export const editInvoiceSchema = z.object({
  invoiceId: z.string().min(1),
  description: z.string().trim().min(2, "Descripción muy corta").max(120),
  amount: z.coerce.number().positive("Monto inválido").max(9_999_999),
  dueDate: z.string().optional(),
});

export const invoiceSchema = z.object({
  description: z.string().trim().min(2, "Descripción muy corta").max(120),
  amount: z.coerce.number().positive("Monto inválido").max(9_999_999),
  dueDate: z.string().optional(),
  // Uno de los dos modos de asignación:
  groupId: z.string().optional(),
  studentIds: z.array(z.string()).optional(),
});
