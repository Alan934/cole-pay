/**
 * Capturas ANOTADAS para la guía corta de alumnos (la que va a Classroom).
 *
 * Además de la foto, exporta las coordenadas de los elementos que hay que
 * señalar, para poder dibujar los recuadros rojos encima sin adivinar
 * posiciones a ojo. Si la UI se mueve, se vuelve a correr y las marcas
 * siguen cayendo en su lugar.
 *
 *   SHOTS_DIR=<carpeta> npx playwright test e2e/zz-guide-short.spec.ts
 */
import { test, type Page, type Locator } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { USERS } from "./helpers/db";
import { seedGuideScenario } from "./helpers/guide-scenario";

const OUT = process.env.SHOTS_DIR ?? "shots";

type Mark = { n: number; label: string; x: number; y: number; w: number; h: number };
type Shot = { w: number; h: number; marks: Mark[] };

const shots: Record<string, Shot> = {};

async function settle(page: Page, keepNav = false) {
  await page.waitForLoadState("networkidle");
  // La barra inferior es `fixed`: se cuela en las capturas de lo que quede
  // debajo. Se oculta salvo cuando justamente la estamos fotografiando.
  await page.addStyleTag({
    content:
      "nextjs-portal{display:none!important}" +
      // Los <style> se acumulan y gana el último: para volver a mostrar la
      // barra no alcanza con no ocultarla, hay que revertirlo.
      (keepNav
        ? "nav.fixed{display:block!important}"
        : "nav.fixed{display:none!important}"),
  });
  await page.waitForTimeout(500);
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
 * Captura `root` (o la página entera) y guarda, en el sistema de coordenadas
 * de esa imagen, la caja de cada elemento a señalar.
 */
async function capture(
  page: Page,
  name: string,
  root: Locator | null,
  marks: { label: string; at: Locator; pad?: number }[],
  keepNav = false,
) {
  await settle(page, keepNav);

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

test.describe("capturas anotadas (guía corta)", () => {
  test.use({ viewport: { width: 440, height: 940 } });

  test.skip(
    !process.env.SHOTS_DIR,
    "Generador de capturas: correr con SHOTS_DIR=<carpeta>",
  );

  test("alumno", async ({ page }) => {
    test.setTimeout(360_000);
    await seedGuideScenario();

    /* --- 1. Entrar --- */
    await page.goto("/login");
    await page.getByLabel("Email").waitFor({ state: "visible", timeout: 60_000 });
    await page.getByLabel("Email").fill(USERS.sofia);
    await page.getByLabel("Contraseña", { exact: true }).fill("alumno1234");
    await capture(page, "s1-entrar", null, [
      { label: "Tu email", at: page.locator("#email") },
      { label: "Tu contraseña", at: page.locator("#password") },
      { label: "Entrar", at: page.getByRole("button", { name: "Ingresar" }) },
    ]);

    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL("**/dashboard", { timeout: 60_000 });

    /* --- 2. La tarjeta --- */
    const card = page.locator("div.rounded-3xl").first();
    await capture(page, "s2-tarjeta", card, [
      { label: "Lo que podés gastar", at: card.locator("p.text-4xl") },
      { label: "Tu nombre corto", at: card.getByRole("button", { name: /Alias/ }) },
      { label: "Tu número de cuenta", at: card.getByRole("button", { name: /CVU/ }) },
      { label: "Esconde el saldo", at: card.locator("button[aria-label*=saldo]") },
    ]);

    /* --- 3. La barra de abajo --- */
    const nav = page.locator("nav").first();
    const links = nav.locator("a");
    await capture(page, "s3-barra", nav, [
      { label: "Inicio", at: links.nth(0), pad: 2 },
      { label: "Enviar", at: links.nth(1), pad: 2 },
      { label: "Pagar", at: links.nth(2), pad: 2 },
      { label: "Avisos", at: links.nth(3), pad: 2 },
      { label: "Ajustes", at: links.nth(4), pad: 2 },
    ], true);

    /* --- 4. Enviar dinero --- */
    await page.goto("/transfer");
    await settle(page);
    await page.locator("#destination").fill("mateo.test.dos");
    await page.locator("#amount").fill("350");
    await page.locator("#category").selectOption("Comida");
    await page.locator("#description").fill("Tu mitad del alfajor");
    const formCard = page.locator("div.rounded-2xl").first();
    await capture(page, "s4-enviar", formCard, [
      { label: "Alias de quien cobra", at: page.locator("#destination") },
      { label: "Cuánto mandás", at: page.locator("#amount") },
      { label: "Para qué es el gasto", at: page.locator("#category") },
      { label: "Continuar", at: page.getByRole("button", { name: "Continuar" }) },
    ]);

    /* --- 5. Pagar cuentas --- */
    await page.goto("/bills");
    await settle(page);
    const bill = page.locator("div.rounded-2xl").first();
    await capture(page, "s5-pagar", bill, [
      { label: "Qué te cobran", at: bill.locator("p.font-medium").first() },
      { label: "Cuándo vence", at: bill.locator("p.text-xs").first() },
      { label: "Pagar", at: bill.getByRole("button", { name: "Pagar" }) },
    ]);

    /* --- 6. Cobrar con QR --- */
    await page.goto("/request");
    await settle(page);
    const qrCard = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Mi QR para recibir" })
      .first();
    await capture(page, "s6-cobrar", qrCard, [
      { label: "Que lo escaneen", at: qrCard.locator("img").first() },
      {
        label: "Te pagan a este alias",
        at: qrCard.locator("span.text-accent").first(),
      },
    ]);

    /* --- 7. Metas de ahorro --- */
    await page.goto("/goals");
    await settle(page);
    const goal = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Campera nueva" })
      .first();
    await capture(page, "s7-metas", goal, [
      { label: "Cuánto llevás", at: goal.locator("div.h-2\\.5").first() },
      { label: "Lo que gana sola por día", at: goal.locator("p.mb-3").first() },
      {
        label: "Hasta cuándo no se toca",
        at: goal.locator("p.text-warning").first(),
      },
      {
        label: "Guardar / sacar plata",
        at: goal.getByRole("button", { name: "Apartar" }),
      },
    ]);

    /* --- 8. Plazo fijo --- */
    await page.goto("/deposits");
    await settle(page);
    await page.locator("#d-principal").fill("5000");
    await page.locator("#d-term").selectOption("30");
    await page.waitForTimeout(300);
    const dep = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Nuevo plazo fijo" })
      .first();
    await capture(page, "s8-plazo", dep, [
      { label: "Cuánto invertís", at: page.locator("#d-principal") },
      { label: "Por cuántos días", at: page.locator("#d-term") },
      {
        label: "Lo que vas a cobrar",
        at: dep.locator("div.bg-raised\\/30").first(),
      },
      {
        label: "Confirmar",
        at: dep.getByRole("button", { name: "Crear plazo fijo" }),
      },
    ]);

    /* --- 9. Rendimientos --- */
    await page.goto("/rendimientos");
    await settle(page);
    const yields = page
      .locator("div.rounded-2xl")
      .filter({ hasText: "Tu dinero ahora mismo" })
      .first();
    const cols = yields.locator("div.grid > div");
    await capture(page, "s9-rendimientos", yields, [
      { label: "Suelta rinde poco", at: cols.nth(0) },
      { label: "Guardada rinde más", at: cols.nth(1) },
      {
        label: "Lo que ganaste sin hacer nada",
        at: yields.locator("div.border-t").first(),
      },
    ]);

    writeFileSync(`${OUT}/marcas.json`, JSON.stringify(shots, null, 2));
    console.log(`\nmarcas.json con ${Object.keys(shots).length} capturas`);
  });
});
