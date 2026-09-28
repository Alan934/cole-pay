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
  role: z
    .enum(["ADMIN", "BANK_ADMIN", "BANK_EMPLOYEE", "STUDENT"])
    .default("STUDENT"),
  /** Banco donde trabaja, cuando el rol es BANK_EMPLOYEE. */
  bankId: z.string().optional(),
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
  // Uno de los dos modos: un alumno puntual o un curso entero.
  studentId: z.string().optional(),
  groupId: z.string().optional(),
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

/* --------------------------- Bancos (quinto año) --------------------------- */

export const bankSchema = z.object({
  name: z.string().trim().min(3, "Nombre demasiado corto").max(40),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido")
    .default("#4f46e5"),
  defaultLimit: z.coerce
    .number({ invalid_type_error: "Límite inválido" })
    .min(0, "No puede ser negativo")
    .max(9_999_999),
  monthlyRatePct: z.coerce
    .number({ invalid_type_error: "Tasa inválida" })
    .min(0, "No puede ser negativa")
    .max(200, "Demasiado alta"),
  closingDay: z.coerce
    .number()
    .int()
    .min(1, "Entre 1 y 28")
    .max(28, "Entre 1 y 28"),
  dueDays: z.coerce
    .number()
    .int()
    .min(1, "Mínimo 1 día")
    .max(30, "Máximo 30 días"),
  loanRatePct: z.coerce
    .number({ invalid_type_error: "Tasa inválida" })
    .min(0, "No puede ser negativa")
    .max(200, "Demasiado alta"),
  maxLoanAmount: z.coerce
    .number({ invalid_type_error: "Monto inválido" })
    .min(0, "No puede ser negativo")
    .max(9_999_999),
});

export const editBankSchema = bankSchema.extend({
  bankId: z.string().min(1),
  active: z
    .union([z.string(), z.boolean(), z.null(), z.undefined()])
    .transform((v) => v === true || v === "on" || v === "true"),
});

/** Asignación de empleados a un banco, de a uno o varios a la vez. */
export const assignEmployeesSchema = z.object({
  bankId: z.string().min(1, "Seleccioná un banco"),
  userIds: z.array(z.string().min(1)).min(1, "Elegí al menos un alumno"),
});

export const fundBankSchema = z.object({
  bankId: z.string().min(1, "Seleccioná un banco"),
  amount: z.coerce.number().positive("Monto inválido").max(99_999_999),
  description: z.string().trim().max(120).optional(),
});

/* ---------------------------- Tarjetas de crédito -------------------------- */

export const cardApplicationSchema = z.object({
  bankId: z.string().min(1, "Elegí un banco"),
  requestedLimit: z.coerce
    .number({ invalid_type_error: "Límite inválido" })
    .positive("El límite debe ser mayor a 0")
    .max(9_999_999),
  monthlyIncome: z.coerce
    .number({ invalid_type_error: "Ingreso inválido" })
    .min(0)
    .max(9_999_999)
    .optional(),
  purpose: z.string().trim().max(200, "Máximo 200 caracteres").optional(),
});

const monthField = z.coerce
  .number({ invalid_type_error: "Mes inválido" })
  .int()
  .min(1, "Mes entre 1 y 12")
  .max(12, "Mes entre 1 y 12");

const yearField = z.coerce
  .number({ invalid_type_error: "Año inválido" })
  .int()
  .min(2020, "Año inválido")
  .max(2100, "Año inválido");

/**
 * Aprobación de una solicitud. En modo "auto" el sistema inventa el número, el
 * vencimiento y el código; en modo "manual" los carga el banco para que la
 * tarjeta virtual quede igual que el plástico que ya tienen en el aula.
 */
export const approveApplicationSchema = z
  .object({
    applicationId: z.string().min(1),
    creditLimit: z.coerce
      .number({ invalid_type_error: "Límite inválido" })
      .positive("El límite debe ser mayor a 0")
      .max(9_999_999),
    brand: z.enum(["VISA", "MASTERCARD", "COLEPAY"]).default("VISA"),
    mode: z.enum(["auto", "manual"]).default("auto"),
    holderName: z.string().trim().max(40).optional(),
    number: z
      .string()
      .trim()
      .transform((v) => v.replace(/[\s-]/g, ""))
      .optional(),
    expMonth: monthField.optional(),
    expYear: yearField.optional(),
    cvv: z.string().trim().optional(),
    note: z.string().trim().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode !== "manual") return;
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (!data.number || !/^\d{16}$/.test(data.number)) {
      issue("number", "El número debe tener 16 dígitos");
    }
    if (!data.expMonth) issue("expMonth", "Indicá el mes de vencimiento");
    if (!data.expYear) issue("expYear", "Indicá el año de vencimiento");
    if (!data.cvv || !/^\d{3}$/.test(data.cvv)) {
      issue("cvv", "El código de seguridad tiene 3 dígitos");
    }
    if (!data.holderName || data.holderName.length < 3) {
      issue("holderName", "Escribí el nombre que figura en la tarjeta");
    }
  });

export const rejectApplicationSchema = z.object({
  applicationId: z.string().min(1),
  reason: z.string().trim().min(3, "Escribí el motivo del rechazo").max(200),
});

export const updateCardSchema = z.object({
  cardId: z.string().min(1),
  creditLimit: z.coerce
    .number({ invalid_type_error: "Límite inválido" })
    .positive("El límite debe ser mayor a 0")
    .max(9_999_999),
  status: z.enum(["ACTIVE", "BLOCKED", "CANCELLED"]),
});

export const payStatementSchema = z.object({
  statementId: z.string().min(1),
  amount: z.coerce
    .number({ invalid_type_error: "Monto inválido" })
    .positive("El monto debe ser mayor a 0")
    .max(9_999_999),
});

/* -------------------------------- Préstamos ------------------------------- */

const installmentsField = z.coerce
  .number({ invalid_type_error: "Cantidad de cuotas inválida" })
  .int()
  .min(1, "Mínimo 1 cuota")
  .max(24, "Máximo 24 cuotas");

export const loanApplicationSchema = z.object({
  bankId: z.string().min(1, "Elegí un banco"),
  requestedAmount: z.coerce
    .number({ invalid_type_error: "Monto inválido" })
    .positive("El monto debe ser mayor a 0")
    .max(9_999_999),
  requestedInstallments: installmentsField,
  monthlyIncome: z.coerce
    .number({ invalid_type_error: "Ingreso inválido" })
    .min(0)
    .max(9_999_999)
    .optional(),
  purpose: z.string().trim().max(200, "Máximo 200 caracteres").optional(),
});

export const approveLoanSchema = z.object({
  loanId: z.string().min(1),
  principal: z.coerce
    .number({ invalid_type_error: "Monto inválido" })
    .positive("El monto debe ser mayor a 0")
    .max(9_999_999),
  monthlyRatePct: z.coerce
    .number({ invalid_type_error: "Tasa inválida" })
    .min(0, "No puede ser negativa")
    .max(200, "Demasiado alta"),
  installments: installmentsField,
  note: z.string().trim().max(200).optional(),
});

export const rejectLoanSchema = z.object({
  loanId: z.string().min(1),
  reason: z.string().trim().min(3, "Escribí el motivo del rechazo").max(200),
});

export const payLoanSchema = z.object({
  loanId: z.string().min(1),
  amount: z.coerce
    .number({ invalid_type_error: "Monto inválido" })
    .positive("El monto debe ser mayor a 0")
    .max(9_999_999),
});

/* --------------------------------- Cheques -------------------------------- */

const chequeNumberField = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => /^\d{4,12}$/.test(v), {
    message: "El número del cheque son entre 4 y 12 dígitos",
  });

const chequeAmountField = z.coerce
  .number({ invalid_type_error: "Importe inválido" })
  .positive("El importe debe ser mayor a 0")
  .max(9_999_999);

/**
 * Alta del cheque. `payableAt` vacío significa "a la vista": se puede cobrar
 * hoy mismo. Con fecha posterior es un cheque diferido.
 */
export const issueChequeSchema = z.object({
  number: chequeNumberField,
  payeeId: z.string().min(1, "Elegí a quién le hacés el cheque"),
  amount: chequeAmountField,
  payableAt: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), {
      message: "Fecha de pago inválida",
    }),
  concept: z.string().trim().max(120, "Máximo 120 caracteres").optional(),
});

/** Alta en la ventanilla: el cajero tiene el papel delante y lo transcribe. */
export const registerChequeSchema = issueChequeSchema.extend({
  drawerId: z.string().min(1, "Elegí quién firmó el cheque"),
});

export const chequeIdSchema = z.object({
  chequeId: z.string().min(1),
});

export const bounceChequeSchema = z.object({
  chequeId: z.string().min(1),
  reason: z.string().trim().max(200).optional(),
});

export const chequeFeeSchema = z.object({
  chequeFeePct: z.coerce
    .number({ invalid_type_error: "Comisión inválida" })
    .min(0, "No puede ser negativa")
    .max(50, "Demasiado alta"),
});

/* ------------------------------- Ventanilla ------------------------------- */

export const cashOperationSchema = z.object({
  customerId: z.string().min(1, "Elegí al cliente"),
  amount: z.coerce
    .number({ invalid_type_error: "Monto inválido" })
    .positive("El monto debe ser mayor a 0")
    .max(9_999_999),
  note: z.string().trim().max(120, "Máximo 120 caracteres").optional(),
});

/* --------------------------- Plazo fijo en el banco ----------------------- */

export const openDepositSchema = z.object({
  bankId: z.string().min(1, "Elegí un banco"),
  termId: z.string().min(1, "Elegí un plazo"),
  principal: z.coerce
    .number({ invalid_type_error: "Monto inválido" })
    .positive("El monto debe ser mayor a 0")
    .max(9_999_999),
});

/** Alta o edición de un plazo en la pizarra de tasas del banco. */
export const bankDepositTermSchema = z.object({
  days: z.coerce
    .number({ invalid_type_error: "Plazo inválido" })
    .int()
    .min(1, "Mínimo 1 día")
    .max(365, "Máximo 365 días"),
  tnaPct: z.coerce
    .number({ invalid_type_error: "TNA inválida" })
    .min(0, "No puede ser negativa")
    .max(9999, "Demasiado alta"),
});
