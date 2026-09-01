/**
 * Dibuja las marcas rojas numeradas sobre las capturas de las guías/TP.
 *
 * Lee `marcas.json` (lo genera el spec de capturas, con las coordenadas reales
 * de cada elemento) y compone encima de cada PNG un recuadro rojo con su
 * número, para no señalar nada a ojo.
 *
 *   node scripts/annotate-shots.mjs <carpeta-de-capturas>
 *
 * Deja los resultados en <carpeta>/anotadas/.
 */
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const DIR = process.argv[2];
if (!DIR) {
  console.error("Uso: node scripts/annotate-shots.mjs <carpeta-de-capturas>");
  process.exit(1);
}

const RED = "#ff2d55";
const OUT = join(DIR, "anotadas");
mkdirSync(OUT, { recursive: true });

const shots = JSON.parse(readFileSync(join(DIR, "marcas.json"), "utf8"));

/** Escapa lo mínimo para meter texto dentro del SVG. */
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

for (const [name, shot] of Object.entries(shots)) {
  const file = join(DIR, `${name}.png`);
  if (!existsSync(file)) {
    console.warn(`⚠️  falta ${name}.png`);
    continue;
  }

  const { width, height } = await sharp(file).metadata();

  if (!shot.marks.length) {
    await sharp(file).toFile(join(OUT, `${name}.png`));
    console.log(`  ${name}: sin marcas (copiada)`);
    continue;
  }

  // Las coordenadas vienen en píxeles CSS; si la captura salió con otro
  // devicePixelRatio, se reescalan.
  const k = width / shot.w;

  const parts = [];
  for (const m of shot.marks) {
    const x = Math.max(1.5, m.x * k);
    const y = Math.max(1.5, m.y * k);
    const w = Math.min(width - x - 1.5, m.w * k);
    const h = Math.min(height - y - 1.5, m.h * k);
    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" ` +
        `fill="none" stroke="${RED}" stroke-width="3"/>`,
    );

    // El globito del número va pegado a la esquina superior izquierda, salvo
    // que se salga de la imagen.
    const cx = Math.min(Math.max(x, 15), width - 15);
    const cy = Math.min(Math.max(y, 15), height - 15);
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="13" fill="${RED}" stroke="#ffffff" stroke-width="2"/>`,
      `<text x="${cx}" y="${cy + 5.5}" text-anchor="middle" fill="#ffffff" ` +
        `font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="bold">${esc(m.n)}</text>`,
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts.join("")}</svg>`;

  await sharp(file)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .toFile(join(OUT, `${name}.png`));

  console.log(`  ${name}: ${shot.marks.length} marcas`);
}

console.log(`\n✅ Capturas anotadas en ${OUT}`);
