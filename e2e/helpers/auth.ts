import { expect, type Page } from "@playwright/test";
import { PASSWORD_ADMIN, PASSWORD_STUDENT, USERS } from "./db";

/** Inicia sesión con credenciales y espera el destino según el rol. */
export async function login(
  page: Page,
  email: string,
  password: string,
  expectPath: string | RegExp,
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(expectPath, { timeout: 20_000 });
}

export async function loginAdmin(page: Page, email = USERS.admin) {
  await login(page, email, PASSWORD_ADMIN, "**/admin");
}

export async function loginStudent(page: Page, email: string) {
  await login(page, email, PASSWORD_STUDENT, "**/dashboard");
}

/** Cierra la sesión actual usando el endpoint de Auth.js. */
export async function logout(page: Page) {
  await page.goto("/api/auth/signout");
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.waitForURL(/localhost/, { timeout: 20_000 });
  await page.context().clearCookies();
}

/** Cambia de usuario limpiando cookies primero (más rápido y confiable). */
export async function switchTo(
  page: Page,
  email: string,
  role: "ADMIN" | "STUDENT",
) {
  await page.context().clearCookies();
  if (role === "ADMIN") await loginAdmin(page, email);
  else await loginStudent(page, email);
}

/** Texto visible del <main> (útil para asserts amplios). */
export async function mainText(page: Page): Promise<string> {
  return (await page.locator("main").innerText()).replace(/\s+/g, " ");
}

/** Espera a que el <main> contenga un texto (tolera revalidaciones lentas). */
export async function expectMainContains(page: Page, needle: string | RegExp) {
  await expect(page.locator("main")).toContainText(needle, { timeout: 15_000 });
}
