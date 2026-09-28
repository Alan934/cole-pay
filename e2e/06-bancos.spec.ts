import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";
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
