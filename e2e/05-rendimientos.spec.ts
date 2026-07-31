import { test, expect } from "@playwright/test";
import {
  resetAndSeed,
  resetSettings,
  USERS,
  db,
  balanceOf,
} from "./helpers/db";
import { loginAdmin, loginStudent, expectMainContains } from "./helpers/auth";
import { TEST_CRON_SECRET } from "../playwright.config";

/**
 * Rendimientos: TNA sobre el saldo y sobre las metas, liquidación diaria,
 * inflación y la parte educativa (calculadora, desglose, quiz).
 */
test.describe("Rendimientos", () => {
  test.beforeEach(async ({ page }) => {
    await resetAndSeed();
    await page.context().clearCookies();
  });

  /* --------------------------- Panel de admin --------------------------- */

  test("el admin activa los rendimientos y define las tasas", async ({
    page,
  }) => {
    await loginAdmin(page);
    await page.goto("/admin/rendimientos");

    await page.getByLabel("TNA del saldo disponible (%)").fill("73");
    await page.getByLabel("TNA de las metas de ahorro (%)").fill("120");
    await page.getByLabel("Permanencia mínima en metas (días)").fill("5");
    await page.getByLabel("Saldo mínimo para generar").fill("100");
    await page.locator('input[name="interestEnabled"]').check();
    await page.getByRole("button", { name: "Guardar tasas" }).click();

    await expectMainContains(page, "Rendimientos activados y tasas");
    const s = await db.bankSettings.findUniqueOrThrow({
      where: { id: "singleton" },
    });
    expect(s.interestEnabled).toBe(true);
    expect(Number(s.balanceTnaPct)).toBe(73);
    expect(Number(s.goalsTnaPct)).toBe(120);
    expect(s.goalsLockDays).toBe(5);
  });

  test("el admin puede dar de alta un plazo nuevo y darlo de baja", async ({
    page,
  }) => {
    await loginAdmin(page);
    await page.goto("/admin/rendimientos");

    await page.getByLabel("Días", { exact: true }).fill("60");
    await page.getByLabel("TNA (%)", { exact: true }).fill("150");
    await page.getByRole("button", { name: "Guardar plazo" }).click();

    await expectMainContains(page, "Plazo de 60 días al 150% TNA guardado");
    const term = await db.depositTerm.findUniqueOrThrow({ where: { days: 60 } });
    expect(Number(term.tnaPct)).toBe(150);
    expect(term.active).toBe(true);
  });

  /* ---------------------------- Liquidación ----------------------------- */

  test("liquidar 10 días acredita el interés según la fórmula", async ({
    page,
  }) => {
    // 36,5% TNA = 0,1% por día. Sofía tiene 5000 → 5 por día → 50 en 10 días.
    await resetSettings({ interestEnabled: true, balanceTnaPct: 36.5 });

    await loginAdmin(page);
    await page.goto("/admin/rendimientos");
    await page.getByLabel("Días a liquidar").fill("10");
    await page.getByRole("button", { name: "Liquidar" }).click();

    await expectMainContains(page, "Liquidaste 10 día(s)");
    await expect
      .poll(async () => balanceOf(USERS.sofia), { timeout: 15_000 })
      .toBe(5050);
    // Mateo tiene 3000 → 30 en 10 días.
    expect(await balanceOf(USERS.mateo)).toBe(3030);

    const run = await db.interestRun.findFirstOrThrow();
    expect(run.days).toBe(10);
    expect(run.trigger).toBe("MANUAL");
    expect(run.walletsCount).toBe(4);

    // El interés lo emite el banco: no sale de la billetera de nadie.
    const tx = await db.transaction.findFirstOrThrow({
      where: { type: "INTEREST", receiver: { email: USERS.sofia } },
    });
    expect(tx.senderId).toBeNull();
    expect(Number(tx.amount)).toBe(50);
  });

  test("no acredita nada si los rendimientos están desactivados", async ({
    page,
  }) => {
    await resetSettings({ interestEnabled: false, balanceTnaPct: 100 });

    await loginAdmin(page);
    await page.goto("/admin/rendimientos");
    await page.getByLabel("Días a liquidar").fill("5");
    await page.getByRole("button", { name: "Liquidar" }).click();

    await expectMainContains(page, "Los rendimientos están desactivados");
    expect(await balanceOf(USERS.sofia)).toBe(5000);
  });

  test("respeta el saldo mínimo para generar interés", async ({ page }) => {
    // Benjamín tiene 1500; con mínimo 2000 queda afuera.
    await resetSettings({
      interestEnabled: true,
      balanceTnaPct: 36.5,
      minBalanceToEarn: 2000,
    });

    await loginAdmin(page);
    await page.goto("/admin/rendimientos");
    await page.getByLabel("Días a liquidar").fill("10");
    await page.getByRole("button", { name: "Liquidar" }).click();

    await expect
      .poll(async () => balanceOf(USERS.sofia), { timeout: 15_000 })
      .toBe(5050);
    expect(await balanceOf(USERS.benja)).toBe(1500);
  });

  /* ------------------------------- El cron ------------------------------ */

  test("el cron rechaza pedidos sin el secreto correcto", async ({
    request,
  }) => {
    await resetSettings({ interestEnabled: true, balanceTnaPct: 36.5 });

    const sinToken = await request.get("/api/cron/accrual");
    expect(sinToken.status()).toBe(401);

    const tokenMalo = await request.get("/api/cron/accrual", {
      headers: { authorization: "Bearer no-es-el-secreto" },
    });
    expect(tokenMalo.status()).toBe(401);

    expect(await balanceOf(USERS.sofia)).toBe(5000);
  });

  test("el cron acredita un día y no vuelve a pagar el mismo período", async ({
    request,
  }) => {
    await resetSettings({ interestEnabled: true, balanceTnaPct: 36.5 });
    const headers = { authorization: `Bearer ${TEST_CRON_SECRET}` };

    const first = await request.get("/api/cron/accrual", { headers });
    expect(first.ok()).toBe(true);
    // 0,1% de 5000 = 5 por día.
    expect(await balanceOf(USERS.sofia)).toBe(5005);

    // Segunda corrida el mismo día: no debe acreditar de nuevo.
    const second = await request.get("/api/cron/accrual", { headers });
    const body = await second.json();
    expect(body.interest.ok).toBe(false);
    expect(await balanceOf(USERS.sofia)).toBe(5005);
    expect(await db.interestRun.count()).toBe(1);
  });

  /* --------------------------- Metas de ahorro -------------------------- */

  test("lo apartado en una meta rinde y queda bloqueado los días definidos", async ({
    page,
  }) => {
    await resetSettings({
      interestEnabled: true,
      balanceTnaPct: 0,
      goalsTnaPct: 73,
      goalsLockDays: 7,
    });

    await loginStudent(page, USERS.sofia);
    await page.goto("/goals");
    await expectMainContains(page, "rinde 73% TNA");

    await page.getByLabel("¿Para qué ahorrás?").fill("Bici");
    await page.getByLabel("Meta").fill("10000");
    await page.getByRole("button", { name: "Crear meta" }).click();

    await page.getByRole("button", { name: "Apartar" }).click();
    await page.getByLabel("¿Cuánto apartás?").fill("1000");
    await page.getByRole("button", { name: "Apartar", exact: true }).last().click();

    await expect
      .poll(async () => balanceOf(USERS.sofia), { timeout: 15_000 })
      .toBe(4000);

    // Queda bloqueada: el botón de retirar no está disponible.
    await page.reload();
    await expectMainContains(page, "Podés retirar a partir del");
    await expect(page.getByRole("button", { name: "Retirar" })).toBeDisabled();

    // El servidor también lo rechaza, aunque se saltee la interfaz.
    const goal = await db.savingsGoal.findFirstOrThrow();
    expect(goal.lockedUntil).not.toBeNull();

    // Y al liquidar, el interés se suma a la meta (no al saldo).
    await page.context().clearCookies();
    await loginAdmin(page);
    await page.goto("/admin/rendimientos");
    await page.getByLabel("Días a liquidar").fill("10");
    await page.getByRole("button", { name: "Liquidar" }).click();
    await expectMainContains(page, "Liquidaste 10 día(s)");

    const after = await db.savingsGoal.findFirstOrThrow();
    // 1000 × 0,73 × 10/365 = 20
    expect(Number(after.savedAmount)).toBe(1020);
    expect(Number(after.earnedInterest)).toBe(20);
    expect(await balanceOf(USERS.sofia)).toBe(4000);
  });

  /* ------------------------- Pantalla del alumno ------------------------ */

  test("el alumno ve la calculadora y el desglose del cálculo", async ({
    page,
  }) => {
    await resetSettings({ interestEnabled: true, balanceTnaPct: 73 });

    await loginStudent(page, USERS.sofia);
    await page.goto("/rendimientos");

    await expectMainContains(page, "Tu dinero ahora mismo");
    await expectMainContains(page, "Calculadora de intereses");
    // La fórmula desarrollada tiene que estar visible.
    await expectMainContains(page, "capital × (TNA ÷ 100) × (días ÷ 365)");
    await expectMainContains(page, "¿Dónde conviene poner la plata?");

    // 10.000 al 73% TNA durante 30 días = 600.
    await page.getByLabel("Capital").fill("10000");
    await page.getByLabel("TNA (%)", { exact: true }).fill("73");
    await page.getByLabel("Días", { exact: true }).selectOption("30");
    await expectMainContains(page, "$ 600,00");
  });

  test("el desafío corrige del lado del servidor", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    await page.goto("/rendimientos");

    await page.getByText("Total Neto Acumulado", { exact: true }).click();
    await page.getByRole("button", { name: "Responder" }).click();
    await expectMainContains(page, "No es esa");

    // Exacto: el glosario también menciona "TNA — Tasa Nominal Anual".
    await page.getByText("Tasa Nominal Anual", { exact: true }).click();
    await page.getByRole("button", { name: "Responder" }).click();
    await expectMainContains(page, "¡Correcto!");

    const attempts = await db.quizAttempt.findMany();
    expect(attempts).toHaveLength(2);
    expect(attempts.filter((a) => a.correct)).toHaveLength(1);
  });

  /* ------------------------------ Inflación ----------------------------- */

  test("aplicar inflación sube el índice y los cobros recurrentes", async ({
    page,
  }) => {
    await resetSettings({ inflationEnabled: true, monthlyInflationPct: 10 });
    const g3a = await db.group.findFirstOrThrow({ where: { name: "3A2026" } });
    await db.recurringCharge.create({
      data: {
        description: "Alquiler del stand",
        amount: 1000,
        intervalDays: 7,
        groupId: g3a.id,
        nextRunAt: new Date(),
      },
    });

    await loginAdmin(page);
    await page.goto("/admin/rendimientos");
    await page.getByRole("button", { name: "Aplicar un mes de inflación" }).click();

    await expectMainContains(page, "Precios actualizados 10%");
    const charge = await db.recurringCharge.findFirstOrThrow();
    expect(Number(charge.amount)).toBe(1100);
    const s = await db.bankSettings.findUniqueOrThrow({
      where: { id: "singleton" },
    });
    expect(Number(s.priceIndex)).toBeCloseTo(110, 2);
  });
});
