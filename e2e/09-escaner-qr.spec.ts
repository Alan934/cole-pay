import { test, expect } from "@playwright/test";
import QRCode from "qrcode";
import { resetAndSeed, USERS, PASSWORD_STUDENT } from "./helpers/db";
import { loginStudent } from "./helpers/auth";

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
