import { test, expect } from "@playwright/test";
import QRCode from "qrcode";
import { resetAndSeed, USERS, PASSWORD_STUDENT, db } from "./helpers/db";
import { loginStudent } from "./helpers/auth";
import { submitTransfer } from "./helpers/ui";

test.describe("Escanear QR de cobro", () => {
  test.beforeEach(async ({ page }) => {
    await resetAndSeed();
    await page.context().clearCookies();
  });

  test("abrir el link de un cobro sin sesión: tras el login va directo a pagar", async ({
    page,
  }) => {
    // Es lo que pasa cuando la cámara del celular abre el QR en un navegador
    // donde el alumno todavía no entró.
    await page.goto("/transfer?to=mateo.test.dos&amount=1500&desc=Rifa");
    await page.waitForURL(/\/login\?.*callbackUrl=/);

    await page.getByLabel("Email").fill(USERS.sofia);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill(PASSWORD_STUDENT);
    await page.getByRole("button", { name: "Ingresar" }).click();

    await page.waitForURL("**/transfer?**", { timeout: 30_000 });
    await expect(page.getByLabel("CVU o Alias del destinatario")).toHaveValue(
      "mateo.test.dos",
    );
    await expect(page.getByLabel("Monto")).toHaveValue("1500");
  });

  test("el callbackUrl no sirve para salir de la app", async ({ page }) => {
    await page.goto("/login?callbackUrl=https://evil.example/robo");
    await page.getByLabel("Email").fill(USERS.sofia);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill(PASSWORD_STUDENT);
    await page.getByRole("button", { name: "Ingresar" }).click();
    // El dominio se descarta: queda la ruta "/robo" dentro de ColePay (404),
    // nunca una redirección al sitio externo.
    await page.waitForURL(/localhost/, { timeout: 30_000 });
    expect(new URL(page.url()).hostname).toBe("localhost");
  });

  test("el botón central abre el escáner", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    const scan = page.getByRole("link", { name: "Escanear QR de cobro" });
    await expect(scan).toBeVisible();
    await scan.click();
    await page.waitForURL("**/scan");
    await expect(
      page.getByRole("heading", { name: "Escanear QR" }),
    ).toBeVisible();
  });

  test("al leer un QR de cobro lleva directo a pagar con la cuenta", async ({
    page,
  }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/scan");

    const qr = await QRCode.toBuffer(
      "https://otro-dominio.example/transfer?to=mateo.test.dos&amount=800&desc=Cafe",
      { width: 400 },
    );
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "qr.png", mimeType: "image/png", buffer: qr });

    await page.waitForURL("**/transfer?**");
    // Se paga en esta app (con la sesión abierta), no en el dominio del QR.
    expect(new URL(page.url()).hostname).toBe("localhost");
    await expect(page.getByLabel("CVU o Alias del destinatario")).toHaveValue(
      "mateo.test.dos",
    );
    await expect(page.getByLabel("Monto")).toHaveValue("800");
  });

  test("un QR que no es de ColePay se rechaza", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/scan");

    const qr = await QRCode.toBuffer("https://www.google.com/", { width: 400 });
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "qr.png", mimeType: "image/png", buffer: qr });

    await expect(page.getByText("Ese QR no es un cobro de ColePay.")).toBeVisible();
    await expect(page).toHaveURL(/\/scan$/);
  });
});

test.describe("Cobro por QR", () => {
  test.beforeEach(async ({ page }) => {
    await resetAndSeed();
    await page.context().clearCookies();
  });

  async function crearCobro(page: import("@playwright/test").Page, monto: string) {
    await page.goto("/request");
    await page.getByLabel("Monto").fill(monto);
    await page.getByLabel("¿Por qué? (opcional)").fill("Rifa");
    await page.getByRole("button", { name: "Crear pedido con QR" }).click();
    await page.waitForURL(/\/request\/[^/]+$/, { timeout: 30_000 });
  }

  test("al crear el cobro te lleva a su QR", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await crearCobro(page, "900");
    const main = page.getByRole("main");
    await expect(main).toContainText("$ 900,00");
    await expect(main).toContainText("Esperando el pago");
    await expect(page.getByRole("img", { name: "Código QR" })).toBeVisible();
  });

  test("quien cobra ve el pago al instante, sin recargar, y queda como Cobro por QR", async ({
    page,
    browser,
  }) => {
    await loginStudent(page, USERS.sofia);
    await crearCobro(page, "900");
    const req = await db.paymentRequest.findFirstOrThrow();

    // Mateo (otro dispositivo) paga escaneando el QR.
    const ctx = await browser.newContext({ baseURL: "http://localhost:3100" });
    const mateo = await ctx.newPage();
    await loginStudent(mateo, USERS.mateo);
    await mateo.goto(
      `/transfer?to=sofia.test.uno&amount=900&desc=Rifa&req=${req.id}&qr=1`,
    );
    // El monto del cobro no se puede cambiar.
    await expect(mateo.getByLabel("Monto")).toHaveAttribute("readonly", "");
    await submitTransfer(mateo);
    await expect(mateo.getByRole("main")).toContainText("¡Pago por QR exitoso!");

    // Sofía no toca nada: la pantalla se actualiza sola.
    await expect(page.getByRole("main")).toContainText("¡Te pagaron!", {
      timeout: 20_000,
    });
    await expect(page.getByRole("main")).toContainText("Pagado por Mateo Test");

    // Es un movimiento de tipo "Cobro por QR", no una transferencia.
    const tx = await db.transaction.findFirstOrThrow({
      where: { receiverId: req.requesterId },
    });
    expect(tx.type).toBe("QR_PAYMENT");
    const paid = await db.paymentRequest.findFirstOrThrow();
    expect(paid.transactionId).toBe(tx.id);

    // Y desde ahí se llega al comprobante, que lo dice.
    await page.getByRole("link", { name: "Ver comprobante" }).click();
    await page.waitForURL("**/receipt/**");
    await expect(page.getByRole("main")).toContainText("Comprobante de cobro por QR");

    await page.goto("/activity");
    await expect(page.getByRole("main")).toContainText("Cobro por QR");
    await ctx.close();
  });

  test("el QR de la lista también se actualiza solo cuando lo pagan", async ({
    page,
    browser,
  }) => {
    await loginStudent(page, USERS.sofia);
    await crearCobro(page, "300");
    const req = await db.paymentRequest.findFirstOrThrow();
    await page.goto("/request");
    await expect(page.getByRole("main")).toContainText("Pendiente");

    const ctx = await browser.newContext({ baseURL: "http://localhost:3100" });
    const mateo = await ctx.newPage();
    await loginStudent(mateo, USERS.mateo);
    await mateo.goto(`/transfer?to=sofia.test.uno&amount=300&req=${req.id}&qr=1`);
    await submitTransfer(mateo);
    await expect(mateo.getByRole("main")).toContainText("¡Pago por QR exitoso!");

    await expect(page.getByRole("main")).toContainText("Pagado por Mateo Test", {
      timeout: 20_000,
    });
    await ctx.close();
  });

  test("el QR sin monto (Mi QR) también registra el pago como Cobro por QR", async ({
    page,
  }) => {
    await loginStudent(page, USERS.mateo);
    await page.goto("/transfer?to=sofia.test.uno&qr=1");
    await expect(page.getByLabel("Monto")).toHaveValue("");
    await page.getByLabel("Monto").fill("250");
    await submitTransfer(page);
    await expect(page.getByRole("main")).toContainText("¡Pago por QR exitoso!");

    const tx = await db.transaction.findFirstOrThrow({
      where: { receiver: { email: USERS.sofia } },
    });
    expect(tx.type).toBe("QR_PAYMENT");
  });

  test("un cobro ya pagado no se puede pagar de nuevo", async ({ page, browser }) => {
    await loginStudent(page, USERS.sofia);
    await crearCobro(page, "500");
    const req = await db.paymentRequest.findFirstOrThrow();

    const ctx = await browser.newContext({ baseURL: "http://localhost:3100" });
    const mateo = await ctx.newPage();
    await loginStudent(mateo, USERS.mateo);
    const link = `/transfer?to=sofia.test.uno&amount=500&req=${req.id}&qr=1`;
    await mateo.goto(link);
    await submitTransfer(mateo);
    await expect(mateo.getByRole("main")).toContainText("¡Pago por QR exitoso!");

    // Segundo intento con el mismo QR: se rechaza y no mueve plata.
    await mateo.goto(link);
    await mateo.getByRole("button", { name: "Continuar" }).click();
    await mateo.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect(mateo.getByRole("main")).toContainText("ya fue pagado o cancelado");
    expect(await db.transaction.count({ where: { type: "QR_PAYMENT" } })).toBe(1);
    await ctx.close();
  });
});
