import { test, expect } from "@playwright/test";
import { resetAndSeed, USERS, db, balanceOf, totalMoney } from "./helpers/db";
import {
  loginAdmin,
  loginStudent,
  switchTo,
  expectMainContains,
} from "./helpers/auth";

test.describe("Flujos mixtos (alumno + admin)", () => {
  test.beforeEach(async ({ page }) => {
    await resetAndSeed();
    await page.context().clearCookies();
  });

  test("ciclo completo: emisión → carga → gasto → cobro → pago → reporte", async ({
    page,
  }) => {
    /* 1. El banco emite dinero nuevo. */
    await loginAdmin(page);
    await page.getByLabel("Monto a crear").fill("10000");
    await page.getByRole("button", { name: "Emitir" }).click();
    await expectMainContains(page, "Emitiste");
    await expect
      .poll(async () => balanceOf(USERS.admin), { timeout: 15_000 })
      .toBe(1_010_000);

    /* 2. Le carga saldo a Sofía (simula efectivo). */
    const depForm = page.locator("form", {
      has: page.getByLabel("Concepto (opcional)"),
    });
    await depForm.getByLabel("Alumno").selectOption({ label: "Sofia Test (3A2026)" });
    await depForm.getByLabel("Monto").fill("2000");
    await depForm.getByRole("button", { name: "Cargar saldo" }).click();
    await expect
      .poll(async () => balanceOf(USERS.sofia), { timeout: 15_000 })
      .toBe(7000);

    /* 3. Emite un cobro para todo el grupo 3A. */
    await page.goto("/admin/services");
    await page.getByLabel("Concepto").fill("Alquiler Stand");
    await page.getByLabel("Monto").fill("1000");
    await page.locator('select[name="groupId"]').selectOption({ label: "3A2026" });
    await page.getByRole("button", { name: "Crear cobro" }).click();
    await expectMainContains(page, "Se crearon 3 cobro(s)");

    const totalAntesDeGastos = await totalMoney();

    /* 4. Sofía ve la deuda, transfiere a Mateo y paga su cuenta. */
    await switchTo(page, USERS.sofia, "STUDENT");
    await expectMainContains(page, "cuenta(s) por pagar");

    await page.goto("/transfer");
    await page.getByLabel("CVU o Alias del destinatario").fill("mateo.test.dos");
    await page.getByLabel("Monto").fill("500");
    await page.getByLabel("Categoría").selectOption("Entretenimiento");
    await page.getByRole("button", { name: "Enviar dinero" }).click();
    await expectMainContains(page, "¡Transferencia exitosa!");

    await page.goto("/bills");
    await page.getByRole("button", { name: "Pagar" }).click();
    await expect
      .poll(async () => balanceOf(USERS.sofia), { timeout: 15_000 })
      .toBe(5500); // 7000 - 500 transferidos - 1000 del cobro

    expect(await balanceOf(USERS.mateo)).toBe(3500);
    // Ni transferir ni pagar crean o destruyen dinero.
    expect(await totalMoney()).toBe(totalAntesDeGastos);

    /* 5. El admin lo ve reflejado en sus reportes. */
    await switchTo(page, USERS.admin, "ADMIN");
    await page.goto("/admin/services");
    await page.getByRole("button", { name: "Pagadas" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);

    await page.goto("/admin/reports");
    await expectMainContains(page, "Ranking por patrimonio");
    const csv = await (await page.request.get("/api/export/debtors")).text();
    // Quedan 2 deudores (Mateo y Valentina); Sofía ya pagó.
    expect(csv).toContain("Mateo Test");
    expect(csv).toContain("Valentina Test");
    expect(csv).not.toContain("Sofia Test");
  });

  test("pedido de cobro con QR: lo paga otro alumno y queda marcado como pagado", async ({
    page,
  }) => {
    /* Sofía crea el pedido. */
    await loginStudent(page, USERS.sofia);
    await page.goto("/request");
    await page.getByLabel("Monto").fill("800");
    await page.getByLabel("¿Por qué? (opcional)").fill("Regalo de Ana");
    await page.getByRole("button", { name: "Crear pedido con QR" }).click();
    await expectMainContains(page, "$ 800,00");

    const req = await db.paymentRequest.findFirstOrThrow();

    /* Mateo abre el link del QR y paga. */
    await switchTo(page, USERS.mateo, "STUDENT");
    await page.goto(
      `/transfer?to=sofia.test.uno&amount=800&desc=Regalo%20de%20Ana&req=${req.id}`,
    );
    // El formulario viene precargado desde el QR.
    await expect(page.getByLabel("CVU o Alias del destinatario")).toHaveValue(
      "sofia.test.uno",
    );
    await expect(page.getByLabel("Monto")).toHaveValue("800");
    await page.getByRole("button", { name: "Enviar dinero" }).click();
    await expectMainContains(page, "¡Transferencia exitosa!");

    /* El pedido queda saldado y con el pagador correcto. */
    await expect
      .poll(async () => (await db.paymentRequest.findFirstOrThrow()).status, {
        timeout: 15_000,
      })
      .toBe("PAID");
    const actualizado = await db.paymentRequest.findFirstOrThrow({
      include: { payer: true },
    });
    expect(actualizado.payer?.email).toBe(USERS.mateo);
    expect(await balanceOf(USERS.sofia)).toBe(5800);
    expect(await balanceOf(USERS.mateo)).toBe(2200);

    /* Sofía lo ve como pagado. */
    await switchTo(page, USERS.sofia, "STUDENT");
    await page.goto("/request");
    await expectMainContains(page, "Pagado por Mateo Test");
  });

  test("una factura no se puede pagar dos veces", async ({ page }) => {
    const admin = await db.user.findFirstOrThrow({ where: { email: USERS.admin } });
    const sofia = await db.user.findFirstOrThrow({ where: { email: USERS.sofia } });
    const inv = await db.invoice.create({
      data: {
        description: "Cobro único",
        amount: 500,
        studentId: sofia.id,
        createdById: admin.id,
      },
    });

    await loginStudent(page, USERS.sofia);
    await page.goto("/bills");
    await page.getByRole("button", { name: "Pagar" }).click();
    await expect
      .poll(async () => balanceOf(USERS.sofia), { timeout: 15_000 })
      .toBe(4500);

    // Segundo intento sobre la misma factura (simula doble clic / reenvío).
    await page.goto("/bills");
    await expect(page.getByRole("button", { name: "Pagar" })).toHaveCount(0);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status).toBe(
      "PAID",
    );
    // El saldo no se descontó dos veces.
    expect(await balanceOf(USERS.sofia)).toBe(4500);
  });

  test("el pago va al profe que emitió el cobro (no al otro)", async ({ page }) => {
    const admin2 = await db.user.findFirstOrThrow({ where: { email: USERS.admin2 } });
    const sofia = await db.user.findFirstOrThrow({ where: { email: USERS.sofia } });
    await db.invoice.create({
      data: {
        description: "Cobro del profe 2",
        amount: 700,
        studentId: sofia.id,
        createdById: admin2.id,
      },
    });

    await loginStudent(page, USERS.sofia);
    await page.goto("/bills");
    await page.getByRole("button", { name: "Pagar" }).click();

    await expect
      .poll(async () => balanceOf(USERS.admin2), { timeout: 15_000 })
      .toBe(700);
    // El primer profe no recibió nada.
    expect(await balanceOf(USERS.admin)).toBe(1_000_000);
    expect(await balanceOf(USERS.sofia)).toBe(4300);
  });

  test("anular un cobro lo saca de las cuentas a pagar del alumno", async ({ page }) => {
    const admin = await db.user.findFirstOrThrow({ where: { email: USERS.admin } });
    const sofia = await db.user.findFirstOrThrow({ where: { email: USERS.sofia } });
    await db.invoice.create({
      data: {
        description: "Cobro equivocado",
        amount: 400,
        studentId: sofia.id,
        createdById: admin.id,
      },
    });

    /* El alumno lo ve pendiente. */
    await loginStudent(page, USERS.sofia);
    await page.goto("/bills");
    await expectMainContains(page, "Cobro equivocado");

    /* El admin lo anula. */
    await switchTo(page, USERS.admin, "ADMIN");
    await page.goto("/admin/services");
    await page.getByRole("button", { name: "Anular" }).click();
    await page.getByRole("button", { name: "Sí, anular" }).click();
    await expect
      .poll(async () => (await db.invoice.findFirstOrThrow()).status, { timeout: 15_000 })
      .toBe("CANCELLED");

    /* El alumno ya no lo ve y le llegó el aviso. */
    await switchTo(page, USERS.sofia, "STUDENT");
    await page.goto("/bills");
    await expectMainContains(page, "¡Estás al día!");
    await page.goto("/notifications");
    await expectMainContains(page, "Cobro anulado");
    expect(await balanceOf(USERS.sofia)).toBe(5000);
  });

  test("premio y multa se reflejan en el alumno y en sus notificaciones", async ({
    page,
  }) => {
    await loginAdmin(page);
    const form = page.locator("form", { has: page.getByLabel("Motivo") });
    await form.getByRole("button", { name: /Premio/ }).click();
    await form.getByLabel("Alumno").selectOption({ label: "Sofia Test (3A2026)" });
    await form.getByLabel("Monto").fill("1000");
    await form.getByLabel("Motivo").fill("Excelente stand");
    await form.getByRole("button", { name: "Premiar" }).click();
    await expectMainContains(page, "Premiaste a");

    await switchTo(page, USERS.sofia, "STUDENT");
    await expectMainContains(page, "$ 6.000,00");
    await page.goto("/notifications");
    await expectMainContains(page, "premio");
    await page.goto("/activity");
    await expectMainContains(page, "Premio: Excelente stand");
  });

  test("recurrente generado por el admin aparece como deuda del alumno y se paga", async ({
    page,
  }) => {
    await loginAdmin(page);
    await page.goto("/admin/recurring");
    await page.getByLabel("Concepto").fill("Alquiler semanal");
    await page.getByLabel("Monto").fill("200");
    await page.getByLabel("Cada (días)").fill("7");
    await page.getByLabel("Grupo").selectOption({ label: "3A2026" });
    await page.getByRole("button", { name: "Programar" }).click();
    await expectMainContains(page, "Cobro recurrente programado");
    await page.getByRole("button", { name: "Generar vencidos" }).click();
    await expectMainContains(page, "Se generaron 3 cobro(s)");

    await switchTo(page, USERS.sofia, "STUDENT");
    await page.goto("/bills");
    await expectMainContains(page, "Alquiler semanal");
    await page.getByRole("button", { name: "Pagar" }).click();
    await expect
      .poll(async () => balanceOf(USERS.sofia), { timeout: 15_000 })
      .toBe(4800);
  });

  test("el ahorro en metas no se puede gastar (baja el disponible)", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/goals");
    await page.getByLabel("¿Para qué ahorrás?").fill("Viaje");
    await page.getByLabel("Meta").fill("5000");
    await page.getByRole("button", { name: "Crear meta" }).click();
    await expectMainContains(page, "Viaje");

    await page.getByRole("button", { name: "Apartar" }).first().click();
    const moveForm = page.locator("form", {
      has: page.getByLabel("¿Cuánto apartás?"),
    });
    await moveForm.getByLabel("¿Cuánto apartás?").fill("4500");
    await moveForm.getByRole("button", { name: "Apartar" }).click();
    await expect
      .poll(async () => balanceOf(USERS.sofia), { timeout: 15_000 })
      .toBe(500);

    // Ahora no le alcanza para una transferencia grande.
    await page.goto("/transfer");
    await page.getByLabel("CVU o Alias del destinatario").fill("mateo.test.dos");
    await page.getByLabel("Monto").fill("3000");
    await page.getByRole("button", { name: "Enviar dinero" }).click();
    await expectMainContains(page, "Saldo insuficiente");
    expect(await balanceOf(USERS.mateo)).toBe(3000);
  });

  test("el dinero total solo cambia con emisión e interés", async ({ page }) => {
    const inicial = await totalMoney();

    /* Transferencias y pagos: total constante. */
    await loginStudent(page, USERS.sofia);
    await page.goto("/transfer");
    await page.getByLabel("CVU o Alias del destinatario").fill("valen.test.tres");
    await page.getByLabel("Monto").fill("1500");
    await page.getByRole("button", { name: "Enviar dinero" }).click();
    await expectMainContains(page, "¡Transferencia exitosa!");
    expect(await totalMoney()).toBe(inicial);

    /* Emisión: el total sube exactamente lo emitido. */
    await switchTo(page, USERS.admin, "ADMIN");
    await page.getByLabel("Monto a crear").fill("5000");
    await page.getByRole("button", { name: "Emitir" }).click();
    await expectMainContains(page, "Emitiste");
    await expect.poll(async () => totalMoney(), { timeout: 15_000 }).toBe(inicial + 5000);
  });
});
