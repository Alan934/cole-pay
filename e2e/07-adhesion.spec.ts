import { test, expect } from "@playwright/test";
import { login, loginStudent, expectMainContains } from "./helpers/auth";
import { chooseOption } from "./helpers/ui";
import { db, USERS } from "./helpers/db";
import {
  BANK_USERS,
  MAIN_BANK,
  PASSWORD_BANK,
  seedBankScenario,
} from "./helpers/bank-scenario";

/**
 * Adhesión de los alumnos de tercero a los bancos.
 *
 * Un alumno sólo opera con los bancos a los que está adherido, y la adhesión
 * la carga un empleado de quinto en el mostrador. El banco principal es el primero al que se adhirió.
 *
 * El escenario deja a "Martina Test" sin ningún banco, y a Sofía y Benjamín
 * adheridos al Banco del Sol (principal) y al Banco Andes. Nadie está en el
 * Banco Río Verde.
 */
const MARTINA = "martina@test.colepay";

async function loginCajera(page: import("@playwright/test").Page) {
  await login(page, BANK_USERS.lucia, PASSWORD_BANK, "**/bank");
}

async function adherirMartina(page: import("@playwright/test").Page) {
  await page.goto("/bank/clients");
  await chooseOption(page.getByRole("combobox", { name: "Alumno" }), "Martina Test");
  await page.getByRole("button", { name: "Adherir al banco" }).click();
}

test.describe("mostrador: alta de clientes", () => {
  test.beforeEach(async () => {
    await seedBankScenario();
  });

  test("adhiere a un alumno desde el mostrador", async ({ page }) => {
    await loginCajera(page);
    await adherirMartina(page);

    await expectMainContains(
      page,
      "Martina Test quedó adherido a " + MAIN_BANK + ". Es su banco principal.",
    );

    const m = await db.bankMembership.findFirstOrThrow({
      where: { student: { email: MARTINA }, bank: { name: MAIN_BANK } },
      include: { registeredBy: true },
    });
    expect(m.endedAt).toBeNull();
    expect(m.registeredBy?.email).toBe(BANK_USERS.lucia);

    // Aparece entre los clientes y se le avisa a ella.
    await expect(page.locator("main")).toContainText("Martina Test");
    expect(
      await db.notification.count({
        where: { user: { email: MARTINA }, title: /Ya sos cliente/ },
      }),
    ).toBe(1);
  });

  test("el banco principal es el primero al que se adhirió", async ({
    page,
  }) => {
    // Martina se adhiere primero al Banco Andes (por afuera) y después al Sol.
    const andes = await db.bank.findFirstOrThrow({ where: { slug: "andes" } });
    const martina = await db.user.findUniqueOrThrow({ where: { email: MARTINA } });
    await db.bankMembership.create({
      data: {
        studentId: martina.id,
        bankId: andes.id,
        adheredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    });

    await loginCajera(page);
    await adherirMartina(page);
    // No es su primer banco: el mensaje no dice que sea el principal.
    await expectMainContains(page, "Martina Test quedó adherido a " + MAIN_BANK + ".");
    await expect(page.locator("main")).not.toContainText("Es su banco principal");

    // En la lista del Sol, Sofía lo tiene de principal y Martina no.
    const filaSofia = page.locator("div.px-4", { hasText: "Sofia Test" }).first();
    await expect(filaSofia).toContainText("Banco principal");
    const filaMartina = page.locator("div.px-4", { hasText: "Martina Test" }).first();
    await expect(filaMartina).not.toContainText("Banco principal");
  });

  test("da de baja a un cliente sin productos abiertos y permite volver a adherirlo", async ({
    page,
  }) => {
    const sol = await db.bank.findFirstOrThrow({ where: { slug: "sol" } });
    const martina = await db.user.findUniqueOrThrow({ where: { email: MARTINA } });
    await db.bankMembership.create({
      data: {
        studentId: martina.id,
        bankId: sol.id,
      },
    });

    await loginCajera(page);
    await page.goto("/bank/clients");
    const fila = page.locator("div.px-4", { hasText: "Martina Test" }).first();
    await fila.getByRole("button", { name: "Dar de baja" }).click();
    await fila.getByRole("button", { name: "Sí, dar de baja" }).click();
    await expectMainContains(page, "Martina Test ya no es cliente de " + MAIN_BANK);

    const baja = await db.bankMembership.findFirstOrThrow({
      where: { studentId: martina.id, bankId: sol.id },
    });
    expect(baja.endedAt).not.toBeNull();

    // Vuelve a adherirse: se reactiva la misma fila.
    await adherirMartina(page);
    await expectMainContains(page, "Martina Test quedó adherido");
    const filas = await db.bankMembership.findMany({
      where: { studentId: martina.id, bankId: sol.id },
    });
    expect(filas).toHaveLength(1);
    expect(filas[0].endedAt).toBeNull();
  });

  test("no da de baja a un cliente con préstamo o plazo fijo abiertos", async ({
    page,
  }) => {
    await loginCajera(page);
    await page.goto("/bank/clients");
    const fila = page.locator("div.px-4", { hasText: "Valentina Test" }).first();
    await fila.getByRole("button", { name: "Dar de baja" }).click();
    await fila.getByRole("button", { name: "Sí, dar de baja" }).click();

    await expectMainContains(page, "Valentina Test todavía tiene");
    await expectMainContains(page, "un préstamo, un plazo fijo");
    const m = await db.bankMembership.findFirstOrThrow({
      where: { student: { email: USERS.valen }, bank: { name: MAIN_BANK } },
    });
    expect(m.endedAt).toBeNull();
  });
});

test.describe("el mostrador sólo atiende a sus clientes", () => {
  test.beforeEach(async () => {
    await seedBankScenario();
  });

  test("la ventanilla de efectivo no ofrece a quien no es cliente", async ({
    page,
  }) => {
    await loginCajera(page);
    await page.goto("/bank/caja");

    const cliente = page.getByLabel("Cliente").first();
    await cliente.click();
    await cliente.fill("Martina");
    await expect(page.getByRole("option")).toHaveCount(0);
    await expect(page.locator("main")).toContainText("No hay ningún cliente");
  });

  test("el cheque de quien no es cliente no se presenta en esta ventanilla", async ({
    page,
  }) => {
    const sofia = await db.user.findUniqueOrThrow({ where: { email: USERS.sofia } });
    const martina = await db.user.findUniqueOrThrow({ where: { email: MARTINA } });
    await db.cheque.create({
      data: {
        number: "00002001",
        amount: 500,
        drawerId: sofia.id,
        payeeId: martina.id,
        registeredById: sofia.id,
        payableAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    await loginCajera(page);
    await page.goto("/bank/cheques");
    // Los cheques de sus clientes sí están; el de Martina no.
    await expect(page.locator("main")).toContainText("0000 1207");
    await expect(page.locator("main")).not.toContainText("0000 2001");

    // Cuando se adhiere, el cheque aparece.
    await adherirMartina(page);
    await expectMainContains(page, "quedó adherido");
    await page.goto("/bank/cheques");
    await expect(page.locator("main")).toContainText("0000 2001");
  });
});

test.describe("alumno: sólo opera con sus bancos", () => {
  test.beforeEach(async () => {
    await seedBankScenario();
  });

  test("sin banco no puede pedir tarjeta, préstamo, plazo fijo ni librar cheques", async ({
    page,
  }) => {
    await loginStudent(page, MARTINA);

    for (const ruta of ["/cards", "/loans", "/deposits", "/cheques"]) {
      await page.goto(ruta);
      await expectMainContains(page, "Primero tenés que ser cliente de un banco");
    }
    await page.goto("/cards");
    await expect(
      page.getByRole("button", { name: "Enviar solicitud" }),
    ).toHaveCount(0);
  });

  test("sólo ve los bancos donde es cliente", async ({ page }) => {
    await loginStudent(page, USERS.sofia);

    await page.goto("/cards");
    await expect(page.getByLabel("Pedir la tarjeta a Banco Andes")).toBeVisible();
    await expect(page.getByLabel("Pedir la tarjeta a Banco Río Verde")).toHaveCount(0);

    await page.goto("/my-banks");
    await expectMainContains(page, MAIN_BANK);
    await expect(page.locator("main")).toContainText("Principal");
  });

  test("el servidor rechaza un pedido a un banco donde no es cliente", async ({
    page,
  }) => {
    const rio = await db.bank.findFirstOrThrow({ where: { slug: "rio-verde" } });
    await loginStudent(page, USERS.sofia);
    await page.goto("/cards");

    // Se fuerza el banco en el formulario, como haría alguien que arma el pedido a mano.
    await page.getByLabel("Límite que pedís").fill("3000");
    await page.evaluate((id) => {
      const el = document.querySelector<HTMLInputElement>('input[name="bankId"]')!;
      el.value = id;
    }, rio.id);
    await page.getByRole("button", { name: "Enviar solicitud" }).click();

    await expectMainContains(page, "Primero tenés que adherirte a Banco Río Verde");
    expect(
      await db.cardApplication.count({ where: { bankId: rio.id } }),
    ).toBe(0);
  });
});
