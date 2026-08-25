/**
 * Generador de capturas para las guías de uso (alumnos y profes).
 *
 * NO es un test: no afirma nada. Siembra un escenario "lindo" en la base de
 * TEST y va sacando fotos de cada pantalla para ilustrar la documentación.
 *
 * Uso:
 *   SHOTS_DIR=/ruta/donde/guardar npx playwright test e2e/zz-guide-screenshots.spec.ts
 *
 * Si se cambia la UI, se vuelve a correr y las capturas quedan al día.
 */
import { test, type Page } from "@playwright/test";
import { USERS } from "./helpers/db";
import { seedGuideScenario } from "./helpers/guide-scenario";

const OUT = process.env.SHOTS_DIR ?? "shots";

/** Espera a que la página termine de pintar antes de la foto. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  // El indicador de dev de Next.js flota sobre la página y ensucia las fotos.
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  // Las animaciones de entrada duran ~300ms.
  await page.waitForTimeout(600);
}

async function shot(page: Page, name: string, fullPage = true) {
  await settle(page);
  // La barra inferior es `fixed`: en una captura de página completa quedaría
  // flotando en el medio. Se oculta solo para la foto (se saca aparte).
  const hide = fullPage
    ? await page.addStyleTag({ content: "nav.fixed{display:none!important}" })
    : null;
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  await hide?.evaluate((el) => el.remove());
}

async function shotOf(page: Page, selectorText: string, name: string) {
  await settle(page);
  // La barra inferior flota sobre el contenido: si la tarjeta que estamos
  // recortando queda debajo, se cuela en la foto.
  const hide = await page.addStyleTag({
    content: "nav.fixed{display:none!important}",
  });
  const card = page
    .locator("div.rounded-2xl, div.rounded-3xl")
    .filter({ hasText: selectorText })
    .first();
  await card.screenshot({ path: `${OUT}/${name}.png` });
  await hide.evaluate((el) => el.remove());
}


/* ------------------------------- Capturas -------------------------------- */

test.describe("capturas para la guía", () => {
  test.use({ viewport: { width: 440, height: 940 } });

  // No es parte de la suite: sólo corre cuando se pide explícitamente
  // pasando SHOTS_DIR. Así `npm run test:e2e` lo saltea.
  test.skip(
    !process.env.SHOTS_DIR,
    "Generador de capturas: correr con SHOTS_DIR=<carpeta>",
  );

  test("alumno", async ({ page }) => {
    test.setTimeout(360_000);
    await seedGuideScenario();

    // 1. Login (deslogueado)
    await page.goto("/login");
    await page.getByLabel("Email").waitFor({ state: "visible", timeout: 60_000 });
    await shot(page, "01-login");

    // Con los campos completos, para mostrar dónde va cada cosa.
    await page.getByLabel("Email").fill(USERS.sofia);
    await page.getByLabel("Contraseña", { exact: true }).fill("alumno1234");
    await shot(page, "02-login-completo");

    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL("**/dashboard", { timeout: 60_000 });

    // 2. Inicio
    await shot(page, "03-dashboard");
    await shotOf(page, "Saldo disponible", "04-tarjeta-saldo");
    await settle(page);
    await page.locator("nav").screenshot({ path: `${OUT}/05-barra-inferior.png` });
    // El título "En qué gastás" vive fuera de la Card: se captura el bloque.
    const hideNav = await page.addStyleTag({
      content: "nav.fixed{display:none!important}",
    });
    await page
      .getByRole("heading", { name: "En qué gastás" })
      .locator("xpath=ancestor::div[2]")
      .screenshot({ path: `${OUT}/06-en-que-gastas.png` });
    await hideNav.evaluate((el) => el.remove());

    // 3. Cuentas a pagar
    await page.goto("/bills");
    await shot(page, "07-cuentas-a-pagar");

    // 4. Cobrar (QR)
    await page.goto("/request");
    await shot(page, "08-cobrar-qr");
    await shotOf(page, "Mi QR para recibir", "09-mi-qr");

    // 5. Metas de ahorro
    await page.goto("/goals");
    await shot(page, "10-metas");
    await shotOf(page, "Campera nueva", "11-meta-detalle");

    // 6. Plazo fijo — con la vista previa del cálculo abierta
    await page.goto("/deposits");
    await settle(page);
    await page.locator("#d-principal").fill("5000");
    await page.locator("#d-term").selectOption("30");
    await shot(page, "12-plazo-fijo");
    await shotOf(page, "Así se calcula lo que vas a cobrar", "13-plazo-calculo");

    // 7. Rendimientos
    await page.goto("/rendimientos");
    await shot(page, "14-rendimientos");
    await shotOf(page, "Tu dinero ahora mismo", "15-tu-dinero-ahora");
    await shotOf(page, "Calculadora de intereses", "16-calculadora");
    await shotOf(page, "Desafío", "17-desafio");

    // 8. Actividad
    await page.goto("/activity");
    await shot(page, "18-actividad");

    // 9. Avisos
    await page.goto("/notifications");
    await shot(page, "19-avisos");

    // 10. Ajustes
    await page.goto("/settings");
    await shot(page, "20-ajustes");

    // 11. Enviar dinero: formulario vacío, completo, confirmación y éxito
    await page.goto("/transfer");
    await shot(page, "21-enviar-vacio");

    await page.locator("#destination").fill("mateo.test.dos");
    await page.locator("#amount").fill("350");
    await page.locator("#category").selectOption("Comida");
    await page
      .locator("#description")
      .fill("Tu mitad del alfajor");
    await shot(page, "22-enviar-completo");

    await page.getByRole("button", { name: "Continuar" }).click();
    const confirmar = page.getByRole("dialog");
    await confirmar.waitFor({ state: "visible", timeout: 30_000 });
    await shot(page, "23-enviar-confirmar");

    await confirmar.getByRole("button", { name: "Confirmar" }).click();
    await page.getByText("¡Transferencia exitosa!").waitFor({ timeout: 30_000 });
    await shot(page, "24-enviar-exito");

    // Error típico: saldo insuficiente
    await page.goto("/transfer");
    await settle(page);
    await page.locator("#destination").fill("mateo.test.dos");
    await page.locator("#amount").fill("999999");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.waitForTimeout(1500);
    await shot(page, "25-enviar-error");
  });
});
