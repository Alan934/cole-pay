import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Une clases de Tailwind resolviendo conflictos. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatea un monto (number o string) como moneda ficticia de ColePay. */
export function formatMoney(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  })
    .format(Number.isFinite(n) ? n : 0)
    .replace("ARS", "$")
    .trim();
}

/** Formatea una fecha de forma legible en español. */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Genera un CVU ficticio de 22 dígitos. */
export function generateCvu(): string {
  let cvu = "";
  for (let i = 0; i < 22; i++) cvu += Math.floor(Math.random() * 10);
  return cvu;
}

/** Genera un alias ficticio tipo "palabra.palabra.palabra". */
export function generateAlias(seed?: string): string {
  const words = [
    "sol",
    "luna",
    "rio",
    "cielo",
    "monte",
    "mar",
    "flor",
    "nube",
    "tigre",
    "coral",
    "verde",
    "faro",
    "cobre",
    "menta",
    "roble",
  ];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  const base = seed
    ? seed.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || pick()
    : pick();
  return `${base}.${pick()}.${pick()}`;
}
