import { test, expect } from "@playwright/test";
import { resetAndSeed, USERS, PASSWORD_ADMIN, PASSWORD_STUDENT } from "./helpers/db";
import { loginAdmin, loginStudent, login } from "./helpers/auth";

test.describe("Autenticación y control de acceso", () => {
  test.beforeEach(async ({ page }) => {
    await resetAndSeed();
    await page.context().clearCookies();
  });

  test("admin inicia sesión y va directo al panel", async ({ page }) => {
    await loginAdmin(page);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Panel de control" })).toBeVisible();
  });

  test("alumno inicia sesión y va al dashboard", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("main")).toContainText("Saldo disponible");
  });

  test("contraseña incorrecta muestra error y no inicia sesión", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(USERS.sofia);
    await page.getByLabel("Contraseña").fill("clave-incorrecta");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.locator("form")).toContainText("Email o contraseña incorrectos");
    await expect(page).toHaveURL(/\/login/);
  });

  test("email inexistente muestra error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nadie@test.colepay");
    await page.getByLabel("Contraseña").fill("loquesea");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.locator("form")).toContainText("Email o contraseña incorrectos");
  });

  test("sin sesión, las rutas privadas redirigen al login", async ({ page }) => {
    for (const path of ["/dashboard", "/admin", "/bills", "/goals", "/admin/students"]) {
      await page.goto(path);
      await expect(page, `ruta ${path}`).toHaveURL(/\/login/);
    }
  });

  test("un alumno NO puede entrar al área de admin", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/admin");
    // El middleware lo rechaza; termina fuera del panel de admin.
    await expect(page.locator("body")).not.toContainText("Panel de control");
    await expect(page).not.toHaveURL(/\/admin$/);
  });

  test("un admin que entra al área de alumno es redirigido a su panel", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("cerrar sesión deja al usuario deslogueado", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await page.getByRole("button", { name: "Salir" }).click();
    await page.waitForURL(/\/login/);
    // Y ya no puede volver a una ruta privada.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("el segundo profe también entra como admin", async ({ page }) => {
    await login(page, USERS.admin2, PASSWORD_ADMIN, "**/admin");
    await expect(page.getByRole("heading", { name: "Panel de control" })).toBeVisible();
  });

  test("el tema claro/oscuro persiste entre recargas", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    const initial = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.getByRole("button", { name: /Activar modo/ }).click();
    const toggled = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(toggled).not.toBe(initial);
    await page.reload();
    const afterReload = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(afterReload).toBe(toggled);
  });

  test("las credenciales de alumno no sirven para el panel admin", async ({ page }) => {
    await login(page, USERS.mateo, PASSWORD_STUDENT, "**/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
