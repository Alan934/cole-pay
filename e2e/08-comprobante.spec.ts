import { test, expect } from "@playwright/test";
import { resetAndSeed, USERS, db } from "./helpers/db";
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

  test("la notificación de quien recibe lleva al comprobante", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/transfer");
    await page.getByLabel("CVU o Alias del destinatario").fill("mateo.test.dos");
    await page.getByLabel("Monto").fill("300");
    await submitTransfer(page);
    await page.getByRole("link", { name: "Ver comprobante" }).waitFor();

    await logout(page);
    await loginStudent(page, USERS.mateo);
    await page.goto("/notifications");
    await page.getByRole("link", { name: /Recibiste dinero/ }).click();
    await page.waitForURL("**/receipt/**");
    await expect(page.getByRole("main")).toContainText("Recibiste");
    await expect(page.getByRole("main")).toContainText("$ 300,00");
  });

  test("compra con tarjeta: comprobante para el titular y para el comercio", async ({
    page,
  }) => {
    // Banco con fondos y una tarjeta activa para Sofía.
    const cuenta = await db.user.create({
      data: {
        name: "Banco de Prueba",
        email: "banco-tarjeta@banco.test.colepay",
        passwordHash: "x",
        role: "BANK",
        wallet: {
          create: {
            cvu: "9999999999999999999992",
            alias: "banco.test.tarjeta",
            balance: 50_000,
          },
        },
      },
    });
    const banco = await db.bank.create({
      data: { name: "Banco de Prueba", slug: "banco-tarjeta", accountId: cuenta.id },
    });
    const sofia = await db.user.findUniqueOrThrow({ where: { email: USERS.sofia } });
    await db.creditCard.create({
      data: {
        bankId: banco.id,
        ownerId: sofia.id,
        brand: "VISA",
        number: "4539148803436467",
        last4: "6467",
        holderName: "SOFIA TEST",
        expMonth: 9,
        expYear: new Date().getFullYear() + 3,
        cvv: "123",
        creditLimit: 5000,
        closingDay: 25,
        dueDays: 10,
        monthlyRatePct: 8,
      },
    });

    await loginStudent(page, USERS.sofia);
    await page.goto("/transfer");
    await page.getByRole("button", { name: "Pagar con la tarjeta de crédito" }).click();
    await page.getByLabel("CVU o Alias del destinatario").fill("mateo.test.dos");
    await page.getByLabel("Monto").fill("800");
    await page.getByLabel("Mensaje (opcional)").fill("Remera");
    await submitTransfer(page);

    // Titular: el comprobante sale desde la pantalla de éxito.
    await page.getByRole("link", { name: "Ver comprobante" }).click();
    await page.waitForURL("**/receipt/**");
    const url = page.url();
    const main = page.getByRole("main");
    await expect(main).toContainText("Pagaste");
    await expect(main).toContainText("$ 800,00");
    await expect(main).toContainText("Visa ••••6467");
    await expect(main).toContainText("Banco de Prueba");
    await expect(main).toContainText("Remera");
    await expect(main).toContainText("Autorización");
    // Paga la titular, no el banco que adelanta la plata.
    await expect(main).toContainText("Sofia Test");

    // También desde la lista de consumos de la tarjeta.
    await page.goto("/cards");
    await expect(page.getByRole("link", { name: "Ver comprobante" })).toBeVisible();

    // Comercio: lo ve como cobro, con el titular como pagador.
    await logout(page);
    await loginStudent(page, USERS.mateo);
    await page.goto(url);
    await expect(page.getByRole("main")).toContainText("Cobraste");
    await expect(page.getByRole("main")).toContainText("Sofia Test");
    await expect(page.getByRole("main")).toContainText("acreditado por el banco emisor");

    // Un tercero no lo ve.
    await logout(page);
    await loginStudent(page, USERS.valen);
    await page.goto(url);
    await expect(page.getByText(/could not be found|no se encontr/i)).toBeVisible();
    await expect(page.getByText("$ 800,00")).toHaveCount(0);
  });
});
