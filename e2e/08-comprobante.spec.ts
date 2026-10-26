import { test, expect } from "@playwright/test";
import { resetAndSeed, USERS } from "./helpers/db";
import { loginStudent, logout } from "./helpers/auth";
import { submitTransfer } from "./helpers/ui";

test.describe("Comprobante de transferencia", () => {
  test.beforeEach(async ({ page }) => {
    await resetAndSeed();
    await page.context().clearCookies();
  });

  test("quien envía lo ve al terminar y quien recibe lo abre desde su actividad", async ({
    page,
  }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/transfer");
    await page.getByLabel("CVU o Alias del destinatario").fill("mateo.test.dos");
    await page.getByLabel("Monto").fill("1200");
    await page.getByLabel("Mensaje (opcional)").fill("El almuerzo");
    await submitTransfer(page);

    // El cartel de éxito ofrece el comprobante y no se va solo.
    await page.getByRole("link", { name: "Ver comprobante" }).click();
    await page.waitForURL("**/receipt/**");
    const url = page.url();

    const main = page.getByRole("main");
    await expect(main).toContainText("Enviaste");
    await expect(main).toContainText("$ 1.200,00");
    await expect(main).toContainText("Sofia Test");
    await expect(main).toContainText("Mateo Test");
    await expect(main).toContainText("mateo.test.dos");
    await expect(main).toContainText("El almuerzo");
    await expect(
      page.getByRole("button", { name: /Compartir|Copiar datos/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Imprimir / PDF" }),
    ).toBeVisible();

    // Quien recibió llega desde el detalle del movimiento.
    await logout(page);
    await loginStudent(page, USERS.mateo);
    await page.goto("/activity");
    await page.getByText("El almuerzo").first().click();
    await page.getByRole("link", { name: /Ver comprobante/ }).click();
    await page.waitForURL(url);
    await expect(page.getByRole("main")).toContainText("Recibiste");
    await expect(page.getByRole("main")).toContainText("$ 1.200,00");
  });

  test("un tercero no puede abrir el comprobante", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/transfer");
    await page.getByLabel("CVU o Alias del destinatario").fill("mateo.test.dos");
    await page.getByLabel("Monto").fill("100");
    await submitTransfer(page);
    await page.getByRole("link", { name: "Ver comprobante" }).click();
    await page.waitForURL("**/receipt/**");
    const url = page.url();

    await logout(page);
    await loginStudent(page, USERS.valen);
    await page.goto(url);
    // Con streaming el status ya salió como 200: lo que importa es que no se
    // vea nada del movimiento.
    await expect(page.getByText(/could not be found|no se encontr/i)).toBeVisible();
    await expect(page.getByText("Sofia Test")).toHaveCount(0);
    await expect(page.getByText("$ 100,00")).toHaveCount(0);
  });
});
