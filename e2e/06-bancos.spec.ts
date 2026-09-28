import { test, expect } from "@playwright/test";
import { login, expectMainContains } from "./helpers/auth";
import { chooseOption } from "./helpers/ui";
import { db } from "./helpers/db";
import {
  BANK_USERS,
  MAIN_BANK,
  PASSWORD_BANK,
  seedBankScenario,
} from "./helpers/bank-scenario";

/**
 * Panel de bancos de la profe de quinto.
 *
 * El escenario deja a propósito un alumno de quinto **sin banco**
 * ("Nicolás Ferro"): es el caso que el aviso de /admin/banks manda a resolver
 * entrando a un banco, y el que se perdía cuando la consulta usaba
 * `bankId: { not: bank.id }` (en SQL, comparar NULL con un id no da verdadero).
 */
test.describe("equipo de un banco", () => {
  test.beforeEach(async () => {
    await seedBankScenario();
  });

  test("asigna a un alumno de quinto que no tenía banco", async ({ page }) => {
    await login(page, BANK_USERS.profe, PASSWORD_BANK, "**/admin/banks");

    await expect(page.locator("main")).toContainText(
      "alumno de quinto sin banco",
    );

    await page.getByRole("link", { name: new RegExp(MAIN_BANK) }).click();
    await page.waitForURL(/\/admin\/banks\/[^/]+$/);

    // Aparece en la lista para sumar, marcado como que no tiene banco.
    const option = page.locator("label").filter({ hasText: "Nicolás Ferro" });
    await expect(option).toBeVisible();
    await expect(option).toContainText("Sin banco");

    await option.locator("input[type=checkbox]").check();
    await page.getByRole("button", { name: /Asignar 1 alumno/ }).click();

    // Ya está en el mostrador y el aviso de la lista de bancos desapareció.
    await expect(page.locator("main")).toContainText(
      "1 alumno asignado a " + MAIN_BANK,
    );
    await expect(page.locator("ul")).toContainText("Nicolás Ferro");

    await page.goto("/admin/banks");
    await expect(page.locator("main")).not.toContainText("sin banco");
  });
});

/**
 * Los alumnos de quinto son los de la profe: los ve, los crea y los mueve de
 * banco desde la misma sección Alumnos.
 */
test.describe("alumnos de quinto", () => {
  test.beforeEach(async () => {
    await seedBankScenario();
  });

  test("sólo lista a los de quinto, con su banco", async ({ page }) => {
    await login(page, BANK_USERS.profe, PASSWORD_BANK, "**/admin/banks");
    await page.goto("/admin/students");

    const tabla = page.locator("tbody");
    await expect(tabla).toContainText("Lucía Álvarez");
    await expect(tabla).toContainText(MAIN_BANK);
    await expect(tabla).toContainText("Sin banco"); // Nicolás Ferro
    // Los clientes de tercero son de la otra profe.
    await expect(page.locator("main")).not.toContainText("Mateo Test");
  });

  test("crea un alumno de quinto y lo asigna a un banco", async ({ page }) => {
    await login(page, BANK_USERS.profe, PASSWORD_BANK, "**/admin/banks");
    await page.goto("/admin/students");

    const form = page.locator("form", { has: page.getByLabel("Email (login)") });
    await form.getByLabel("Nombre").fill("Camila Nueva");
    await form.getByLabel("Email (login)").fill("camila@test.colepay");
    await form.getByLabel("DNI (opcional)").fill("47222333");
    await form.getByLabel("Contraseña", { exact: true }).fill(PASSWORD_BANK);
    await chooseOption(form.getByLabel("Banco"), MAIN_BANK);
    await form.getByRole("button", { name: "Crear alumno" }).click();

    await expectMainContains(page, new RegExp(`asignado a ${MAIN_BANK}`));

    const creada = await db.user.findUnique({
      where: { email: "camila@test.colepay" },
      include: { bank: true, wallet: true },
    });
    expect(creada?.role).toBe("BANK_EMPLOYEE");
    expect(creada?.bank?.name).toBe(MAIN_BANK);
    // Atiende el mostrador: no tiene cuenta propia ni queda en un curso.
    expect(creada?.wallet).toBeNull();
    expect(creada?.groupId).toBeNull();
  });

  test("no deja crear un alumno sin banco", async ({ page }) => {
    await login(page, BANK_USERS.profe, PASSWORD_BANK, "**/admin/banks");
    await page.goto("/admin/students");

    const form = page.locator("form", { has: page.getByLabel("Email (login)") });
    await form.getByLabel("Nombre").fill("Sin Banco");
    await form.getByLabel("Email (login)").fill("sinbanco@test.colepay");
    await form.getByLabel("Contraseña", { exact: true }).fill(PASSWORD_BANK);
    await form.getByRole("button", { name: "Crear alumno" }).click();

    // El campo es obligatorio: el navegador ni siquiera envía el formulario.
    await expect
      .poll(async () =>
        db.user.count({ where: { email: "sinbanco@test.colepay" } }),
      )
      .toBe(0);
  });

  test("cambia de banco a un alumno desde la ficha", async ({ page }) => {
    await login(page, BANK_USERS.profe, PASSWORD_BANK, "**/admin/banks");
    await page.goto("/admin/students");

    await page
      .locator("tr", { hasText: "Nicolás Ferro" })
      .getByRole("button", { name: "Editar" })
      .click();
    const dialog = page.locator("form", {
      has: page.getByLabel("Nueva contraseña (opcional)"),
    });
    await chooseOption(dialog.getByLabel("Banco"), MAIN_BANK);
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();

    await expect
      .poll(
        async () =>
          (
            await db.user.findUnique({
              where: { email: BANK_USERS.nico },
              include: { bank: true },
            })
          )?.bank?.name,
        { timeout: 15_000 },
      )
      .toBe(MAIN_BANK);
  });
});
