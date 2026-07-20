import { test, expect } from "@playwright/test";
import {
  resetAndSeed,
  USERS,
  db,
  balanceOf,
  totalMoney,
} from "./helpers/db";
import { loginStudent, expectMainContains } from "./helpers/auth";

test.describe("Flujo del alumno", () => {
  test.beforeEach(async ({ page }) => {
    await resetAndSeed();
    await page.context().clearCookies();
  });

  /* ------------------------------- Dashboard ------------------------------ */

  test("el dashboard muestra saldo, alias y CVU", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await expectMainContains(page, "$ 5.000,00");
    await expectMainContains(page, "sofia.test.uno");
    await expectMainContains(page, "7777777777777777777773"); // CVU sembrado
  });

  /* ----------------------------- Transferencias --------------------------- */

  test("transferencia exitosa por alias mueve el dinero en ambos lados", async ({
    page,
  }) => {
    const antes = await totalMoney();
    await loginStudent(page, USERS.sofia);
    await page.goto("/transfer");
    await page.getByLabel("CVU o Alias del destinatario").fill("mateo.test.dos");
    await page.getByLabel("Monto").fill("1200");
    await page.getByLabel("Categoría").selectOption("Comida");
    await page.getByLabel("Mensaje (opcional)").fill("El almuerzo");
    await page.getByRole("button", { name: "Enviar dinero" }).click();

    await expectMainContains(page, "¡Transferencia exitosa!");
    expect(await balanceOf(USERS.sofia)).toBe(3800);
    expect(await balanceOf(USERS.mateo)).toBe(4200);
    // El dinero no se crea ni se destruye en una transferencia.
    expect(await totalMoney()).toBe(antes);
  });

  test("transferencia por CVU también funciona", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/transfer");
    await page
      .getByLabel("CVU o Alias del destinatario")
      .fill("7777777777777777777774"); // CVU de Mateo
    await page.getByLabel("Monto").fill("500");
    await page.getByRole("button", { name: "Enviar dinero" }).click();
    await expectMainContains(page, "¡Transferencia exitosa!");
    expect(await balanceOf(USERS.mateo)).toBe(3500);
  });

  test("rechaza transferencia con saldo insuficiente", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/transfer");
    await page.getByLabel("CVU o Alias del destinatario").fill("mateo.test.dos");
    await page.getByLabel("Monto").fill("999999");
    await page.getByRole("button", { name: "Enviar dinero" }).click();
    await expectMainContains(page, "Saldo insuficiente");
    expect(await balanceOf(USERS.sofia)).toBe(5000);
    expect(await balanceOf(USERS.mateo)).toBe(3000);
  });

  test("rechaza transferirse dinero a uno mismo", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/transfer");
    await page.getByLabel("CVU o Alias del destinatario").fill("sofia.test.uno");
    await page.getByLabel("Monto").fill("100");
    await page.getByRole("button", { name: "Enviar dinero" }).click();
    await expectMainContains(page, "No podés transferirte dinero a vos mismo");
    expect(await balanceOf(USERS.sofia)).toBe(5000);
  });

  test("rechaza destinatario inexistente", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/transfer");
    await page.getByLabel("CVU o Alias del destinatario").fill("no.existe.nadie");
    await page.getByLabel("Monto").fill("100");
    await page.getByRole("button", { name: "Enviar dinero" }).click();
    await expectMainContains(page, "No se encontró una cuenta");
    expect(await balanceOf(USERS.sofia)).toBe(5000);
  });

  /* ------------------------------- Alias/ajustes -------------------------- */

  test("puede cambiar su alias", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/settings");
    await page.getByLabel("Tu alias").fill("sofia.nuevo.alias");
    await page.getByRole("button", { name: "Guardar alias" }).click();
    await expectMainContains(page, "Alias actualizado");
    const w = await db.wallet.findFirst({ where: { alias: "sofia.nuevo.alias" } });
    expect(w).not.toBeNull();
  });

  test("rechaza un alias ya usado por otro alumno", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/settings");
    await page.getByLabel("Tu alias").fill("mateo.test.dos");
    await page.getByRole("button", { name: "Guardar alias" }).click();
    await expectMainContains(page, "ya está en uso");
  });

  test("rechaza alias con caracteres inválidos", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/settings");
    await page.getByLabel("Tu alias").fill("alias con espacios!");
    await page.getByRole("button", { name: "Guardar alias" }).click();
    await expectMainContains(page, /Solo letras, números|Mínimo/);
  });

  /* --------------------------- Cuentas a pagar ---------------------------- */

  test("paga una factura pendiente y queda registrada", async ({ page }) => {
    const { sofia, admin } = await seedInvoice();
    await loginStudent(page, USERS.sofia);
    await page.goto("/bills");
    await expectMainContains(page, "Alquiler Stand A");
    await page.getByRole("button", { name: "Pagar" }).first().click();
    await expectMainContains(page, /Pagado|¡Estás al día!/);

    await expect
      .poll(async () => balanceOf(USERS.sofia), { timeout: 15_000 })
      .toBe(4000);
    expect(await balanceOf(USERS.admin)).toBe(1_001_000);

    const inv = await db.invoice.findFirst({ where: { studentId: sofia.id } });
    expect(inv?.status).toBe("PAID");
    expect(inv?.transactionId).not.toBeNull();
    void admin;
  });

  test("no puede pagar si no le alcanza el saldo", async ({ page }) => {
    const g = await db.group.findFirstOrThrow({ where: { name: "3A2026" } });
    const admin = await db.user.findFirstOrThrow({ where: { email: USERS.admin } });
    const benja = await db.user.findFirstOrThrow({ where: { email: USERS.benja } });
    await db.invoice.create({
      data: {
        description: "Cobro carísimo",
        amount: 99999,
        studentId: benja.id,
        createdById: admin.id,
      },
    });
    void g;

    await loginStudent(page, USERS.benja);
    await page.goto("/bills");
    await expectMainContains(page, "Saldo insuficiente");
    await page.getByRole("button", { name: "Pagar" }).first().click();
    await expectMainContains(page, "Saldo insuficiente para pagar");
    expect(await balanceOf(USERS.benja)).toBe(1500);
  });

  /* ------------------------------ Notificaciones -------------------------- */

  test("recibe notificación al recibir dinero y puede marcarla leída", async ({
    page,
  }) => {
    // Mateo le transfiere a Sofía.
    await loginStudent(page, USERS.mateo);
    await page.goto("/transfer");
    await page.getByLabel("CVU o Alias del destinatario").fill("sofia.test.uno");
    await page.getByLabel("Monto").fill("300");
    await page.getByRole("button", { name: "Enviar dinero" }).click();
    await expectMainContains(page, "¡Transferencia exitosa!");

    // Sofía la ve.
    await page.context().clearCookies();
    await loginStudent(page, USERS.sofia);
    await page.goto("/notifications");
    await expectMainContains(page, "¡Recibiste dinero!");
    await page.getByRole("button", { name: "Marcar leídas" }).click();
    await expect(page.getByRole("button", { name: "Marcar leídas" })).toHaveCount(0);
  });

  /* ------------------------------ Metas de ahorro ------------------------- */

  test("crea una meta, aparta dinero y el saldo disponible baja", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/goals");
    await page.getByLabel("¿Para qué ahorrás?").fill("Auriculares");
    await page.getByLabel("Meta").fill("2000");
    await page.getByRole("button", { name: "Crear meta" }).click();
    await expectMainContains(page, "Auriculares");

    await page.getByRole("button", { name: "Apartar" }).first().click();
    const moveForm = page.locator("form", {
      has: page.getByLabel("¿Cuánto apartás?"),
    });
    await moveForm.getByLabel("¿Cuánto apartás?").fill("500");
    await moveForm.getByRole("button", { name: "Apartar" }).click();

    await expect.poll(async () => balanceOf(USERS.sofia), { timeout: 15_000 }).toBe(4500);
    const goal = await db.savingsGoal.findFirstOrThrow();
    expect(Number(goal.savedAmount)).toBe(500);
    // El dinero apartado sigue siendo del alumno: el total no cambia.
    expect(await totalMoney()).toBe(1_017_500);
  });

  test("no puede apartar más de lo que tiene (validación del servidor)", async ({
    page,
  }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/goals");
    await page.getByLabel("¿Para qué ahorrás?").fill("Imposible");
    await page.getByLabel("Meta").fill("999999");
    await page.getByRole("button", { name: "Crear meta" }).click();
    await expectMainContains(page, "Imposible");

    await page.getByRole("button", { name: "Apartar" }).first().click();
    const moveForm = page.locator("form", {
      has: page.getByLabel("¿Cuánto apartás?"),
    });
    const amount = moveForm.getByLabel("¿Cuánto apartás?");
    // El input limita con `max`, pero el servidor debe rechazarlo igual:
    // quitamos la restricción del HTML para probar la defensa real.
    await amount.evaluate((el: HTMLInputElement) => el.removeAttribute("max"));
    await amount.fill("99999");
    await moveForm.getByRole("button", { name: "Apartar" }).click();

    await expectMainContains(page, "No tenés saldo suficiente");
    expect(await balanceOf(USERS.sofia)).toBe(5000);
  });

  test("al eliminar una meta se devuelve lo ahorrado", async ({ page }) => {
    const sofia = await db.user.findFirstOrThrow({ where: { email: USERS.sofia } });
    await db.savingsGoal.create({
      data: { userId: sofia.id, name: "Vieja", targetAmount: 1000, savedAmount: 400 },
    });
    await db.wallet.update({
      where: { userId: sofia.id },
      data: { balance: 4600 },
    });

    await loginStudent(page, USERS.sofia);
    await page.goto("/goals");
    await page.getByRole("button", { name: "Eliminar meta" }).click();
    await expect.poll(async () => balanceOf(USERS.sofia), { timeout: 15_000 }).toBe(5000);
    expect(await db.savingsGoal.count()).toBe(0);
  });

  /* -------------------------------- Plazo fijo ---------------------------- */

  test("crea un plazo fijo y no puede cobrarlo antes del vencimiento", async ({
    page,
  }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/deposits");
    await page.getByLabel("Monto a invertir").fill("1000");
    await page.getByLabel("Plazo").selectOption("30");
    await page.getByRole("button", { name: "Crear plazo fijo" }).click();

    await expectMainContains(page, "Cobrás al vencer");
    await expect.poll(async () => balanceOf(USERS.sofia), { timeout: 15_000 }).toBe(4000);
    // Todavía no venció → no hay botón de cobro.
    await expect(page.getByRole("button", { name: "Cobrar" })).toHaveCount(0);
    await expectMainContains(page, "$ 1.120,00"); // 1000 + 12%
  });

  test("cobra el plazo fijo vencido con su interés", async ({ page }) => {
    const sofia = await db.user.findFirstOrThrow({ where: { email: USERS.sofia } });
    await db.fixedDeposit.create({
      data: {
        userId: sofia.id,
        principal: 1000,
        ratePct: 12,
        maturesAt: new Date(Date.now() - 86_400_000), // venció ayer
      },
    });
    await db.wallet.update({ where: { userId: sofia.id }, data: { balance: 4000 } });

    await loginStudent(page, USERS.sofia);
    await page.goto("/deposits");
    await page.getByRole("button", { name: "Cobrar" }).click();

    await expect.poll(async () => balanceOf(USERS.sofia), { timeout: 15_000 }).toBe(5120);
    const dep = await db.fixedDeposit.findFirstOrThrow();
    expect(dep.status).toBe("WITHDRAWN");
    expect(Number(dep.payoutAmount)).toBe(1120);
    // El interés lo emite el banco → aparece como transacción INTEREST.
    const interes = await db.transaction.findFirst({ where: { type: "INTEREST" } });
    expect(Number(interes?.amount)).toBe(120);
  });

  /* ---------------------------- Pedidos de cobro -------------------------- */

  test("crea un pedido de cobro y puede cancelarlo", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/request");
    await page.getByLabel("Monto").fill("700");
    await page.getByLabel("¿Por qué? (opcional)").fill("Regalo de Ana");
    await page.getByRole("button", { name: "Crear pedido con QR" }).click();
    await expectMainContains(page, "$ 700,00");

    expect(await db.paymentRequest.count({ where: { status: "PENDING" } })).toBe(1);

    await page.getByRole("button", { name: "Cancelar pedido" }).click();
    await expect
      .poll(async () => db.paymentRequest.count({ where: { status: "CANCELLED" } }), {
        timeout: 15_000,
      })
      .toBe(1);
  });

  /* ------------------------- Actividad y paginación ----------------------- */

  test("el historial pagina cuando hay muchos movimientos", async ({ page }) => {
    const sofia = await db.user.findFirstOrThrow({ where: { email: USERS.sofia } });
    const mateo = await db.user.findFirstOrThrow({ where: { email: USERS.mateo } });
    for (let i = 0; i < 20; i++) {
      await db.transaction.create({
        data: {
          type: "TRANSFER",
          amount: 1,
          description: `Movimiento ${i}`,
          senderId: sofia.id,
          receiverId: mateo.id,
        },
      });
    }
    await loginStudent(page, USERS.sofia);
    await page.goto("/activity");
    await expectMainContains(page, "Página 1 de 2");
    await page.getByRole("link", { name: "Siguiente" }).click();
    await expectMainContains(page, "Página 2 de 2");
  });

  test("el resumen de gastos agrupa por categoría", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/transfer");
    await page.getByLabel("CVU o Alias del destinatario").fill("mateo.test.dos");
    await page.getByLabel("Monto").fill("400");
    await page.getByLabel("Categoría").selectOption("Comida");
    await page.getByRole("button", { name: "Enviar dinero" }).click();
    await expectMainContains(page, "¡Transferencia exitosa!");

    await page.goto("/dashboard");
    await expectMainContains(page, "En qué gastás");
    await expectMainContains(page, "Comida");
  });
});

/** Crea una factura pendiente de $1000 para Sofía. */
async function seedInvoice() {
  const admin = await db.user.findFirstOrThrow({ where: { email: USERS.admin } });
  const sofia = await db.user.findFirstOrThrow({ where: { email: USERS.sofia } });
  await db.invoice.create({
    data: {
      description: "Alquiler Stand A",
      amount: 1000,
      studentId: sofia.id,
      createdById: admin.id,
    },
  });
  return { admin, sofia };
}
