/**
 * Capturas ANOTADAS de las guías de quinto año:
 *   - el mostrador del banco (alumnos de quinto, rol BANK_EMPLOYEE)
 *   - el panel de bancos (profe de quinto, rol BANK_ADMIN)
 *
 * Además de la foto exporta, en `marcas.json`, las coordenadas reales de cada
 * elemento a señalar, para que `scripts/annotate-shots.mjs` dibuje los
 * recuadros rojos sin adivinar posiciones.
 *
 *   SHOTS_DIR=quintoshots npx playwright test e2e/zz-quinto-shots.spec.ts
 */
import { test, type Page, type Locator } from "@playwright/test";
import { writeFileSync } from "node:fs";
import {
  BANK_USERS,
  MAIN_BANK,
  PASSWORD_BANK,
  seedBankScenario,
} from "./helpers/bank-scenario";

const OUT = process.env.SHOTS_DIR ?? "quintoshots";

type Mark = { n: number; label: string; x: number; y: number; w: number; h: number };
type Shot = { w: number; h: number; marks: Mark[] };

const shots: Record<string, Shot> = {};

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({
    content:
      "nextjs-portal{display:none!important}" +
      // La barra de secciones scrollea de costado: en una captura quedaría
      // cortada, así que se la deja envolver en dos filas.
      "header nav{flex-wrap:wrap!important;overflow:visible!important}",
  });
  await page.waitForTimeout(400);
}

/** Caja de un elemento en coordenadas del documento. */
async function docBox(loc: Locator) {
  return loc.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return {
      x: r.x + window.scrollX,
      y: r.y + window.scrollY,
      w: r.width,
      h: r.height,
    };
  });
}

/**
 * Captura `root` (o la página entera) y guarda, en el sistema de coordenadas de
 * esa imagen, la caja de cada elemento a señalar.
 */
async function capture(
  page: Page,
  name: string,
  root: Locator | null,
  marks: { label: string; at: Locator; pad?: number }[],
) {
  await settle(page);
  if (root) await root.scrollIntoViewIfNeeded();

  const origin = root ? await docBox(root) : { x: 0, y: 0, w: 0, h: 0 };

  if (root) {
    await root.screenshot({ path: `${OUT}/${name}.png` });
  } else {
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  }

  const size = root
    ? { w: Math.round(origin.w), h: Math.round(origin.h) }
    : await page.evaluate(() => ({
        w: document.documentElement.scrollWidth,
        h: document.documentElement.scrollHeight,
      }));

  const out: Mark[] = [];
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i];
    const b = await docBox(m.at);
    const pad = m.pad ?? 4;
    out.push({
      n: i + 1,
      label: m.label,
      x: Math.round(b.x - origin.x - pad),
      y: Math.round(b.y - origin.y - pad),
      w: Math.round(b.w + pad * 2),
      h: Math.round(b.h + pad * 2),
    });
  }

  shots[name] = { w: size.w, h: size.h, marks: out };
  console.log(`  ${name}: ${size.w}x${size.h}, ${out.length} marcas`);
}

async function login(page: Page, email: string, waitFor: string) {
  await page.goto("/login");
  await page.getByLabel("Email").waitFor({ state: "visible", timeout: 60_000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD_BANK);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(waitFor, { timeout: 60_000 });
}

test.describe("capturas anotadas (guías de quinto)", () => {
  /**
   * Ancho elegido para que cada tarjeta mida ~670 px y entre casi 1:1 en el
   * ancho útil de la hoja A4 (~600 px): con 1280 el texto quedaba ilegible al
   * escalarlo dentro del Word. x2 para que además imprima nítido.
   */
  test.use({
    viewport: { width: 700, height: 1000 },
    deviceScaleFactor: 2,
  });

  test.skip(
    !process.env.SHOTS_DIR,
    "Generador de capturas: correr con SHOTS_DIR=<carpeta>",
  );

  test("mostrador y panel", async ({ page }) => {
    test.setTimeout(600_000);
    await seedBankScenario();

    /* ================================================================== */
    /* Guía de los alumnos de quinto: el mostrador                         */
    /* ================================================================== */

    /* --- 1. Entrar --- */
    await page.goto("/login");
    await page.getByLabel("Email").waitFor({ state: "visible", timeout: 60_000 });
    await page.locator("#email").fill(BANK_USERS.lucia);
    await page.locator("#password").fill(PASSWORD_BANK);
    const loginCard = page.locator("form").first();
    await capture(page, "q1-entrar", loginCard, [
      { label: "El email que les dieron", at: page.locator("#email") },
      { label: "La contraseña", at: page.locator("#password") },
      { label: "Entrar al mostrador", at: page.getByRole("button", { name: "Ingresar" }) },
    ]);

    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL("**/bank", { timeout: 60_000 });
    await settle(page);

    /* --- 2. El menú del banco --- */
    // Las ocho secciones ya se leen solas: recuadrarlas una por una sólo
    // ensucia la tira. La leyenda va en la tabla de la guía.
    const nav = page.locator("nav").first();
    await capture(page, "q2-menu", nav, []);

    /* --- 3. Los números del mostrador --- */
    const stats = page.locator("div.grid").first();
    const statCards = stats.locator("> div");
    await capture(page, "q3-mostrador", stats, [
      { label: "La plata que tienen", at: statCards.nth(0) },
      { label: "Lo que está afuera", at: statCards.nth(1) },
      { label: "Pedidos sin contestar", at: statCards.nth(2) },
      { label: "Tarjetas que emitieron", at: statCards.nth(3) },
      { label: "Clientes que no pagaron", at: statCards.nth(4) },
    ]);

    /* --- 4. Revisar una solicitud de tarjeta --- */
    await page.goto("/bank/applications");
    await settle(page);
    const app = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Límite pedido" })
      .first();
    await capture(page, "q4-solicitud", app, [
      { label: "Quién la pide y de qué curso", at: app.locator("h3").first() },
      { label: "Cuánto pide", at: app.locator("p.text-lg").first() },
      { label: "Con qué plata cuenta", at: app.locator("dl").first() },
      { label: "Para qué la quiere", at: app.locator("p.rounded-xl").first() },
      { label: "Decidir", at: app.getByRole("button", { name: "Aprobar y emitir" }) },
    ]);

    /* --- 5. Emitir la tarjeta --- */
    await app.getByRole("button", { name: "Aprobar y emitir" }).click();
    await page.waitForTimeout(400);
    const form = app.locator("form").first();
    // Los datos se copian del plástico que ya tienen en el aula: la guía
    // muestra el modo manual, no el automático.
    const manualBtn = form.getByRole("button", {
      name: "Cargar a mano los datos de la tarjeta",
    });
    await manualBtn.click();
    await page.waitForTimeout(300);
    await capture(page, "q5-emitir", form, [
      { label: "El límite que le dan ustedes", at: form.locator("input[name=creditLimit]") },
      { label: "Marca del plástico", at: form.locator("select[name=brand]") },
      { label: "Copiar los datos del plástico", at: manualBtn },
      { label: "Los 16 números de la tarjeta", at: form.locator("input[name=number]") },
      { label: "Nombre impreso y vencimiento", at: form.locator("input[name=holderName]") },
      { label: "Queda emitida", at: form.getByRole("button", { name: /Emitir/ }) },
    ]);

    /* --- 6. Las tarjetas emitidas --- */
    await page.goto("/bank/cards");
    await settle(page);
    const cardRow = page.locator("div.rounded-2xl").first();
    await cardRow.locator("button").first().click();
    await page.waitForTimeout(400);
    await capture(page, "q6-tarjetas", cardRow, [
      { label: "El cliente", at: cardRow.locator("span.font-semibold").first() },
      { label: "Cuánto debe hoy", at: cardRow.locator("dl").first() },
      { label: "Subir o bajar el límite", at: cardRow.locator("input[name=creditLimit]") },
      { label: "Bloquear la tarjeta", at: cardRow.locator("select[name=status]") },
      { label: "Emitir el resumen", at: cardRow.getByRole("button", { name: /Cerrar/ }) },
    ]);

    /* --- 7. Un préstamo --- */
    await page.goto("/bank/loans");
    await settle(page);
    // El texto del filtro tiene que seguir estando después de abrir el
    // formulario: el botón "Aprobar" desaparece y el locator dejaría de matchear.
    const loan = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Ingreso declarado" })
      .first();
    await loan.getByRole("button", { name: /Aprobar/ }).click();
    await page.waitForTimeout(400);
    const loanForm = loan.locator("form").first();
    await capture(page, "q7-prestamo", loanForm, [
      { label: "Capital que sale de la caja", at: loanForm.locator("input[name=principal]") },
      { label: "Interés por mes", at: loanForm.locator("input[name=monthlyRatePct]") },
      { label: "En cuántas cuotas", at: loanForm.locator("input[name=installments]") },
      { label: "La cuenta hecha: la ganancia del banco", at: loanForm.locator("div.rounded-xl").first() },
      { label: "Le sale la plata", at: loanForm.getByRole("button", { name: /Desembolsar/ }) },
    ]);

    /* --- 8. Cobrar un cheque --- */
    await page.goto("/bank/cheques");
    await settle(page);
    const cheque = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Hacer efectivo" })
      .first();
    await capture(page, "q8-cheque", cheque, [
      { label: "Importe y número del papel", at: cheque.locator("p.font-semibold").first() },
      { label: "Quién lo firmó y para quién es", at: cheque.locator("p.text-xs").first() },
      { label: "Si el que firmó tiene la plata", at: cheque.locator("div.rounded-xl").first() },
      { label: "Pagarlo", at: cheque.getByRole("button", { name: "Hacer efectivo" }) },
      { label: "No pagarlo", at: cheque.getByRole("button", { name: "Rechazar" }) },
    ]);

    /* --- 9. Cargar un cheque de papel y la comisión --- */
    const feeCard = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Comisión por cheque" })
      .first();
    const regCard = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Cargar un cheque de papel" })
      .first();
    await regCard.getByRole("button", { name: "Cargar cheque" }).click();
    await page.waitForTimeout(400);
    const chequeTop = page.locator("div.grid").filter({ has: feeCard }).first();
    await capture(page, "q9-cheque-alta", chequeTop, [
      { label: "Lo que se queda el banco", at: feeCard.locator("#fee") },
      { label: "Número del papel", at: regCard.locator("#r-number") },
      { label: "Importe", at: regCard.locator("#r-amount") },
      { label: "Quién lo firmó", at: regCard.locator("#r-drawer") },
      { label: "A la orden de quién", at: regCard.locator("#r-payee") },
      { label: "Desde cuándo se puede cobrar", at: regCard.locator("#r-payable") },
    ]);

    /* --- 10. La ventanilla de efectivo --- */
    await page.goto("/bank/caja");
    await settle(page);
    const deposit = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Depósito en efectivo" })
      .first();
    await capture(page, "q10-ventanilla", deposit, [
      { label: "A quién atienden", at: deposit.locator("#deposit-customer") },
      { label: "Cuántos billetes contaron", at: deposit.locator("#deposit-amount") },
      { label: "De dónde salió esa plata", at: deposit.locator("#deposit-note") },
      { label: "Entra a la caja", at: deposit.getByRole("button", { name: /Acreditar/ }) },
    ]);

    /* --- 11. La pizarra de plazos fijos --- */
    await page.goto("/bank/deposits");
    await settle(page);
    const board = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Pizarra de tasas" })
      .first();
    await capture(page, "q11-plazos", board, [
      { label: "Lo que pagan contra lo que cobran", at: board.locator("div.rounded-xl").first() },
      { label: "Los plazos que ofrecen hoy", at: board.locator("div.divide-y").first() },
      { label: "Por cuántos días", at: board.locator("#t-days") },
      { label: "Cuánto pagan por año (TNA)", at: board.locator("#t-tna") },
      { label: "Queda en la pizarra", at: board.getByRole("button", { name: /Publicar/ }) },
    ]);

    /* --- 12. La cuenta del banco --- */
    await page.goto("/bank/account");
    await settle(page);
    const accStats = page.locator("div.grid").first();
    const accCards = accStats.locator("> div");
    await capture(page, "q12-cuenta", accStats, [
      { label: "Lo que hay ahora", at: accCards.nth(0) },
      { label: "Todo lo que entró", at: accCards.nth(1) },
      { label: "Todo lo que salió", at: accCards.nth(2) },
    ]);

    /* ================================================================== */
    /* Guía de la profe de quinto: el panel de bancos                      */
    /* ================================================================== */

    await page.getByRole("button", { name: "Salir" }).click();
    await page.waitForURL("**/login", { timeout: 60_000 });

    await page.goto("/login");
    await page.getByLabel("Email").waitFor({ state: "visible", timeout: 60_000 });
    await page.locator("#email").fill(BANK_USERS.profe);
    await page.locator("#password").fill(PASSWORD_BANK);
    const profeCard = page.locator("form").first();
    await capture(page, "p1-entrar", profeCard, [
      { label: "Tu email de profe de quinto", at: page.locator("#email") },
      { label: "Tu contraseña", at: page.locator("#password") },
      { label: "Entrás directo a Bancos", at: page.getByRole("button", { name: "Ingresar" }) },
    ]);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL("**/admin/banks", { timeout: 60_000 });
    await settle(page);

    /* --- 2. Tu menú --- */
    const header = page.locator("header").first();
    const adminNav = header.locator("nav").first();
    const adminLinks = adminNav.locator("a");
    // El orden de la barra es el del menú completo del admin: Alumnos, Bancos
    // y Tarjetas.
    await capture(page, "p2-menu", header, [
      { label: "Alumnos: las cuentas de tercero", at: adminLinks.nth(0), pad: 2 },
      { label: "Bancos: crear, capitalizar, equipos", at: adminLinks.nth(1), pad: 2 },
      { label: "Tarjetas: todo el crédito del sistema", at: adminLinks.nth(2), pad: 2 },
      { label: "Salir", at: header.getByRole("button", { name: "Salir" }), pad: 2 },
    ]);

    /* --- 3. La lista de bancos --- */
    // Siempre el banco que tiene equipo y movimientos: el de las capturas.
    const bankCard = page
      .locator("a")
      .filter({ hasText: MAIN_BANK })
      .first();
    await capture(page, "p3-bancos", bankCard, [
      { label: "Tocá el banco para entrar", at: bankCard.locator("p.font-semibold").first() },
      { label: "Cuántos lo atienden", at: bankCard.locator("p.text-xs").first() },
      { label: "Abierto o cerrado", at: bankCard.locator("span.rounded-full").first() },
      { label: "Caja, prestado e interés", at: bankCard.locator("dl").first() },
    ]);

    /* --- 4. Crear un banco --- */
    const createBank = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Crear un banco" })
      .first();
    await capture(page, "p4-crear-banco", createBank, [
      { label: "Nombre y color de sus tarjetas", at: createBank.locator("#bank-name") },
      { label: "Límite con el que salen las tarjetas", at: createBank.locator("#bank-limit") },
      { label: "Interés si el cliente no paga todo", at: createBank.locator("#bank-rate") },
      { label: "Cuándo cierra y cuándo vence el resumen", at: createBank.locator("#bank-closing") },
      { label: "Condiciones de los préstamos", at: createBank.locator("#bank-loan-rate") },
      { label: "Crear", at: createBank.getByRole("button", { name: /Crear/ }) },
    ]);

    /* --- 5. Crear los usuarios de quinto --- */
    const createUser = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Crear un usuario de quinto" })
      .first();
    await capture(page, "p5-crear-usuario", createUser, [
      { label: "Nombre y apellido del alumno", at: createUser.locator("#bu-name") },
      { label: "Con este email entra", at: createUser.locator("#bu-email") },
      { label: "Contraseña provisoria", at: createUser.locator("#bu-password") },
      { label: "Empleado del banco o profe", at: createUser.locator("#bu-role") },
      { label: "Crear la cuenta", at: createUser.getByRole("button", { name: /Crear/ }) },
    ]);

    /* --- 6. Adentro del banco: capitalizar --- */
    await bankCard.click();
    await page.waitForURL(/\/admin\/banks\/[^/]+$/, { timeout: 60_000 });
    await settle(page);
    const fund = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Capitalizar" })
      .first();
    await capture(page, "p6-capitalizar", fund, [
      { label: "Cuánta plata le das", at: fund.locator("#fund-amount") },
      { label: "Por qué se la das", at: fund.locator("#fund-desc") },
      { label: "Entra a su caja", at: fund.getByRole("button", { name: "Capitalizar el banco" }) },
      { label: "Si el banco no cierra, cerrás vos", at: fund.getByRole("button", { name: /Cerrar el período/ }) },
    ]);

    /* --- 7. El equipo del banco --- */
    const team = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Equipo del banco" })
      .first();
    await team.locator("input[type=checkbox]").first().check();
    await page.waitForTimeout(300);
    await capture(page, "p7-equipo", team, [
      { label: "Los que ya atienden", at: team.locator("ul").first() },
      { label: "Sacarlo del mostrador", at: team.getByRole("button", { name: "Quitar del banco" }).first() },
      { label: "Tildá a los que faltan", at: team.locator("div.max-h-64").first() },
      { label: "Sumarlos al banco", at: team.getByRole("button", { name: /Asignar/ }) },
    ]);

    /* --- 8. La política de crédito --- */
    const policy = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "política de crédito" })
      .first();
    await capture(page, "p8-politica", policy, [
      { label: "Lo que cambies vale para las próximas", at: policy.locator("#bank-limit") },
      { label: "Interés del préstamo y tope", at: policy.locator("#bank-max-loan") },
      { label: "Cerrar el banco lo deja sin operar", at: policy.locator("input[name=active]") },
      { label: "Guardar", at: policy.getByRole("button", { name: /Guardar/ }) },
    ]);

    /* --- 9. Supervisar el crédito --- */
    await page.goto("/admin/cards");
    await settle(page);
    const cardStats = page.locator("div.grid").first();
    const cardStatCards = cardStats.locator("> div");
    await capture(page, "p9-credito", cardStats, [
      { label: "Solicitudes que ningún banco contestó", at: cardStatCards.nth(0) },
      { label: "Tarjetas en la calle", at: cardStatCards.nth(1) },
      { label: "Plata prestada con tarjeta", at: cardStatCards.nth(2) },
      { label: "Clientes que no pagaron", at: cardStatCards.nth(3) },
    ]);

    const superApp = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Límite pedido" })
      .first();
    await capture(page, "p10-resolver", superApp, [
      { label: "Quién pide y a qué banco", at: superApp.locator("div.flex-wrap").first() },
      { label: "Los datos del cliente", at: superApp.locator("dl").first() },
      { label: "Podés resolverla vos", at: superApp.getByRole("button", { name: "Aprobar y emitir" }) },
    ]);

    /* --- 10. Los alumnos de tercero --- */
    await page.goto("/admin/students");
    await settle(page);
    const listCol = page.locator("div.grid > div.flex-col").last();
    await capture(page, "p11-alumnos", listCol, [
      { label: "Buscar por nombre, DNI o email", at: page.getByLabel("Buscar alumno") },
      { label: "Filtrar por curso", at: page.getByLabel("Filtrar por grupo") },
      { label: "El saldo de cada cliente", at: listCol.locator("table") },
      { label: "Corregir datos o blanquear la clave", at: listCol.getByRole("button", { name: "Editar" }).first() },
    ]);

    writeFileSync(`${OUT}/marcas.json`, JSON.stringify(shots, null, 2));
    console.log(`\nmarcas.json con ${Object.keys(shots).length} capturas`);
  });
});
