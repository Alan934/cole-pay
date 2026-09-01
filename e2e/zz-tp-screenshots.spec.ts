/**
 * Capturas para el TRABAJO PRÁCTICO de los alumnos (el .docx que va al campus).
 *
 * Igual que `zz-guide-short.spec.ts`, además de la foto exporta las coordenadas
 * de los elementos a señalar (`marcas.json`) para que el script de anotación
 * dibuje los recuadros rojos numerados sin adivinar posiciones.
 *
 *   SHOTS_DIR=<carpeta> npx playwright test e2e/zz-tp-screenshots.spec.ts
 */
import { test, type Page, type Locator } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { db, USERS } from "./helpers/db";
import { seedGuideScenario } from "./helpers/guide-scenario";

const OUT = process.env.SHOTS_DIR ?? "shots";

/** El alumno ficticio del TP (el mismo que existe en producción). */
const TP = {
  name: "Tomás Ledesma",
  email: "tomas.ledesma@colepay.edu",
  dni: "45887310",
  cuit: "20458873101",
  alias: "tomi.ledesma.tp",
  cvu: "4076663351044461346089",
};

type Mark = { n: number; label: string; x: number; y: number; w: number; h: number };
type Shot = { w: number; h: number; marks: Mark[] };

const shots: Record<string, Shot> = {};

async function settle(page: Page, keepNav = false) {
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({
    content:
      "nextjs-portal{display:none!important}" +
      (keepNav
        ? "nav.fixed{display:block!important}"
        : "nav.fixed{display:none!important}"),
  });
  await page.waitForTimeout(400);
}

async function docBox(loc: Locator) {
  return loc.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.width, h: r.height };
  });
}

type Target = { label: string; at: Locator; pad?: number };

/**
 * Captura `root` (o la página entera) y guarda, en coordenadas de esa imagen,
 * la caja de cada elemento a señalar.
 */
async function capture(
  page: Page,
  name: string,
  root: Locator | null,
  marks: Target[],
  opts: { keepNav?: boolean; fullPage?: boolean } = {},
) {
  await settle(page, opts.keepNav);

  const origin = root ? await docBox(root) : { x: 0, y: 0, w: 0, h: 0 };
  const fullPage = opts.fullPage ?? false;

  if (root) {
    await root.screenshot({ path: `${OUT}/${name}.png` });
  } else {
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  }

  const size = root
    ? { w: Math.round(origin.w), h: Math.round(origin.h) }
    : await page.evaluate(
        (full) => ({
          w: document.documentElement.scrollWidth,
          h: full ? document.documentElement.scrollHeight : window.innerHeight,
        }),
        fullPage,
      );

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

/** Crea en la base de test el mismo alumno ficticio que usa el TP. */
async function seedTpUser() {
  await db.user.create({
    data: {
      name: TP.name,
      email: TP.email,
      dni: TP.dni,
      cuit: TP.cuit,
      passwordHash: "$2a$10$notarealhash000000000000000000000000000000000000000000",
      role: "STUDENT",
      wallet: { create: { cvu: TP.cvu, alias: TP.alias, balance: new Prisma.Decimal(0) } },
    },
  });
}

test.describe("capturas del TP", () => {
  test.use({ viewport: { width: 440, height: 820 } });

  test.skip(!process.env.SHOTS_DIR, "Generador de capturas: correr con SHOTS_DIR=<carpeta>");

  test("alumno", async ({ page }) => {
    test.setTimeout(600_000);
    await seedGuideScenario();
    await seedTpUser();

    /* ---------- 1. Entrar ---------- */
    await page.goto("/login");
    await page.getByLabel("Email").waitFor({ state: "visible", timeout: 60_000 });
    await page.getByLabel("Email").fill(USERS.sofia);
    await page.getByLabel("Contraseña", { exact: true }).fill("alumno1234");
    // Sólo la columna del formulario: la pantalla entera queda con mucho negro.
    const loginBox = page.locator("main > div.w-full").first();
    await capture(page, "t01-login", loginBox, [
      { label: "Email", at: page.locator("#email") },
      { label: "Contraseña", at: page.locator("#password") },
      { label: "Ingresar", at: page.getByRole("button", { name: "Ingresar" }) },
    ]);

    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL("**/dashboard", { timeout: 60_000 });

    /* ---------- 2. Inicio ---------- */
    const balanceCard = page.locator("div.rounded-3xl").first();
    await capture(page, "t02-inicio", null, [
      { label: "Saldo disponible", at: balanceCard.locator("p.text-4xl") },
      { label: "Alias", at: balanceCard.getByRole("button", { name: /Alias/ }) },
      { label: "CVU", at: balanceCard.getByRole("button", { name: /CVU/ }) },
      { label: "Ocultar saldo", at: balanceCard.locator("button[aria-label*=saldo]") },
      { label: "Accesos rápidos", at: page.locator("div.grid.grid-cols-4").first() },
    ]);

    /* ---------- 3. Barra de abajo ---------- */
    const nav = page.locator("nav.fixed").first();
    const links = nav.locator("a");
    await capture(
      page,
      "t03-barra",
      nav,
      [
        { label: "Inicio", at: links.nth(0), pad: 2 },
        { label: "Enviar", at: links.nth(1), pad: 2 },
        { label: "Pagar", at: links.nth(2), pad: 2 },
        { label: "Avisos", at: links.nth(3), pad: 2 },
        { label: "Ajustes", at: links.nth(4), pad: 2 },
      ],
      { keepNav: true },
    );

    /* ---------- 4. Ajustes: cambiar el alias ---------- */
    await page.goto("/settings");
    await settle(page);
    const aliasCard = page.locator("div.rounded-2xl").filter({ hasText: "Cambiar alias" }).first();
    await capture(page, "t04-alias", aliasCard, [
      { label: "Tu alias nuevo", at: page.locator("#alias") },
      { label: "Guardar", at: aliasCard.getByRole("button") },
    ]);

    /* ---------- 5. Transferir ---------- */
    await page.goto("/transfer");
    await settle(page);
    await page.locator("#destination").fill(TP.alias);
    await page.locator("#amount").fill("450");
    await page.locator("#category").selectOption("Comida");
    await page.locator("#description").fill("Mi parte del TP");
    const formCard = page.locator("div.rounded-2xl").first();
    await capture(page, "t05-enviar", formCard, [
      { label: "Alias o CVU de quien recibe", at: page.locator("#destination") },
      { label: "Monto", at: page.locator("#amount") },
      { label: "Categoría del gasto", at: page.locator("#category") },
      { label: "Mensaje", at: page.locator("#description") },
      { label: "Continuar", at: page.getByRole("button", { name: "Continuar" }) },
    ]);

    /* ---------- 6. Confirmación ---------- */
    await page.getByRole("button", { name: "Continuar" }).click();
    const dialog = page.locator("[role=dialog]");
    await dialog.waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForTimeout(600);
    await capture(page, "t06-confirmar", dialog, [
      { label: "Nombre y DNI de quien cobra", at: dialog.locator("p.font-semibold").first() },
      { label: "Alias y CVU verificados", at: dialog.locator("dl") },
      { label: "Monto a enviar", at: dialog.locator("div.bg-accent\\/10").first() },
      { label: "Confirmar", at: dialog.getByRole("button", { name: "Confirmar" }) },
    ]);

    /* ---------- 7. Comprobante ---------- */
    await dialog.getByRole("button", { name: "Confirmar" }).click();
    await page.getByText("¡Transferencia exitosa!").waitFor({ timeout: 30_000 });
    const okCard = page.locator("div.rounded-2xl").first();
    await capture(page, "t07-exito", okCard, [
      { label: "Comprobante", at: page.getByText("¡Transferencia exitosa!") },
    ]);

    /* ---------- 8. Pagar cuentas ---------- */
    await page.goto("/bills");
    await settle(page);
    const bill = page.locator("div.rounded-2xl").first();
    await capture(page, "t08-pagar", bill, [
      { label: "Qué te cobran", at: bill.locator("p.font-medium").first() },
      { label: "Vencimiento", at: bill.locator("p.text-xs").first() },
      { label: "Pagar", at: bill.getByRole("button", { name: "Pagar" }) },
    ]);

    /* ---------- 9. Cobrar con QR ---------- */
    await page.goto("/request");
    await settle(page);
    const qrCard = page.locator("div.rounded-2xl").filter({ hasText: "Mi QR para recibir" }).first();
    await capture(page, "t09-qr", qrCard, [
      { label: "Tu QR", at: qrCard.locator("img").first() },
      { label: "Te pagan a este alias", at: qrCard.locator("span.text-accent").first() },
    ]);

    const reqCard = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Pedir un monto puntual" })
      .first();
    await page.locator("#r-amount").fill("1200");
    await page.locator("#r-desc").fill("Rifa del curso");
    await capture(page, "t10-pedido", reqCard, [
      { label: "Cuánto pedís", at: page.locator("#r-amount") },
      { label: "Por qué", at: page.locator("#r-desc") },
      { label: "Crear pedido con QR", at: reqCard.getByRole("button") },
    ]);

    /* ---------- 10. Metas de ahorro ---------- */
    await page.goto("/goals");
    await settle(page);
    const newGoal = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Nueva meta de ahorro" })
      .first();
    await page.locator("#g-name").fill("Campera nueva");
    await page.locator("#g-target").fill("15000");
    await capture(page, "t11-meta-nueva", newGoal, [
      { label: "Para qué ahorrás", at: page.locator("#g-name") },
      { label: "Cuánto querés juntar", at: page.locator("#g-target") },
      { label: "Crear meta", at: newGoal.getByRole("button") },
    ]);

    const goal = page.locator("div.rounded-2xl").filter({ hasText: "Campera nueva" }).last();
    await capture(page, "t12-meta", goal, [
      { label: "Cuánto llevás", at: goal.locator("div.h-2\\.5").first() },
      { label: "Lo que gana por día", at: goal.locator("p.mb-3").first() },
      { label: "Apartar plata", at: goal.getByRole("button", { name: "Apartar" }) },
    ]);

    /* ---------- 11. Plazo fijo ---------- */
    await page.goto("/deposits");
    await settle(page);
    await page.locator("#d-principal").fill("5000");
    await page.locator("#d-term").selectOption("30");
    await page.waitForTimeout(400);
    const dep = page.locator("div.rounded-2xl").filter({ hasText: "Nuevo plazo fijo" }).first();
    await capture(page, "t13-plazo", dep, [
      { label: "Cuánto invertís", at: page.locator("#d-principal") },
      { label: "Por cuántos días", at: page.locator("#d-term") },
      { label: "Lo que vas a cobrar", at: dep.locator("div.bg-raised\\/30").first() },
      { label: "Crear plazo fijo", at: dep.getByRole("button", { name: "Crear plazo fijo" }) },
    ]);

    /* ---------- 12. Rendimientos ---------- */
    await page.goto("/rendimientos");
    await settle(page);
    const estado = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Tu dinero ahora mismo" })
      .first();
    const cols = estado.locator("div.grid > div");
    await capture(page, "t14-rendimientos", estado, [
      { label: "Saldo: rinde poco", at: cols.nth(0) },
      { label: "Metas: rinde más", at: cols.nth(1) },
      { label: "Ganado sin hacer nada", at: estado.locator("div.border-t").first() },
    ]);

    const calc = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Calculadora de intereses" })
      .first();
    await page.locator("#calc-amount").fill("10000");
    await page.locator("#calc-days").selectOption("30");
    await page.waitForTimeout(300);
    await capture(page, "t15-calculadora", calc, [
      { label: "Capital", at: page.locator("#calc-amount") },
      { label: "Días", at: page.locator("#calc-days") },
      { label: "TNA", at: page.locator("#calc-tna") },
      { label: "La cuenta paso a paso", at: calc.locator("ol").first() },
    ]);

    const quiz = page.locator("div.rounded-2xl").filter({ hasText: "Desafío" }).first();
    await capture(page, "t16-desafio", quiz, [
      { label: "La pregunta", at: quiz.locator("p").nth(1) },
    ]);

    /* ---------- 13. Actividad y comprobante ---------- */
    await page.goto("/activity");
    await settle(page);
    const list = page.locator("div.rounded-2xl").first();
    await capture(page, "t17-actividad", list, [
      { label: "Tocá un movimiento para abrir el comprobante", at: list.locator("summary").first() },
    ]);

    const row = list.locator("details").first();
    await row.locator("summary").click();
    await page.waitForTimeout(400);
    await capture(page, "t19-comprobante", row, [
      { label: "Datos de la otra parte", at: row.locator("dl, div.border-t").first() },
    ]);

    /* ---------- 14. En qué gastás ---------- */
    await page.goto("/dashboard");
    await settle(page);
    // La tarjeta del resumen es la hermana del título "En qué gastás".
    const spend = page.locator(
      "xpath=//h2[contains(., 'En qué gastás')]/../following-sibling::div[1]",
    );
    await spend.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await capture(page, "t20-gastos", spend, []);

    /* ---------- 14. Avisos ---------- */
    await page.goto("/notifications");
    await settle(page);
    await capture(page, "t18-avisos", null, []);

    writeFileSync(`${OUT}/marcas.json`, JSON.stringify(shots, null, 2));
    console.log(`\nmarcas.json con ${Object.keys(shots).length} capturas`);
  });
});
