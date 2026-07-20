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
export const createDepositSchema = z.object({
  principal: z.coerce.number().positive("Monto inválido").max(9_999_999),
  termDays: z.coerce.number().refine((v) => [7, 14, 30].includes(v), {
    message: "Plazo inválido",
  }),
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

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Nombre demasiado corto"),
  email: z.string().email("Email inválido").toLowerCase(),
  password: z.string().min(4, "Mínimo 4 caracteres"),
  groupId: z.string().optional(),
  role: z.enum(["ADMIN", "STUDENT"]).default("STUDENT"),
});

export const editUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(2, "Nombre demasiado corto"),
  email: z.string().email("Email inválido").toLowerCase(),
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
