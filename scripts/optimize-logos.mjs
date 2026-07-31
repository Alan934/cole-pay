/**
 * Genera los assets de marca optimizados a partir de los originales.
 *
 *   npm run logos
 *
 * Fuentes (no se publican, quedan fuera de /public):
 *   assets/brand/logo-mark-source.png      — isotipo (billetera + birrete)
 *   assets/brand/logo-wordmark-source.png  — logo completo con el nombre
 *
 * Salidas:
 *   public/logo-mark.png       — isotipo, para el tile del header
 *   public/logo-wordmark.png   — lockup completo, para el hero del login
 *   src/app/icon.png           — favicon (convención de Next)
 *   src/app/apple-icon.png     — ícono de "agregar a inicio" en iOS
 *
 * Tres cosas explican la diferencia de peso contra los originales:
 *
 *  1. Recorte del borde vacío y reescalado a los tamaños que la UI realmente
 *     usa (los originales venían a 1024 px para mostrarse a 32-160 px).
 *  2. Los PNG originales guardan color basura en los píxeles transparentes,
 *     que el compresor no puede aprovechar. Se limpia antes de reescalar.
 *  3. Se aplana contra blanco. El isotipo es azul marino (#102050) y sobre el
 *     tema oscuro queda con 1.2:1 de contraste, así que en la UI siempre va
 *     montado sobre un tile blanco; sin transparencia que preservar, el canal
 *     alfa deja de costar (~70% del peso del WebP que sirve Next).
 *     Si alguna vez hace falta el logo sobre un fondo de color, hay que
 *     regenerar estos assets sin el `.flatten()`.
 */
import sharp from "sharp";
import { mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";

const MARK_SRC = "assets/brand/logo-mark-source.png";
const WORDMARK_SRC = "assets/brand/logo-wordmark-source.png";
const WHITE = { r: 255, g: 255, b: 255 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const PNG_OPTS = { compressionLevel: 9, effort: 10, palette: true, quality: 90 };

/**
 * Recorta el borde transparente y pone RGB en 0 donde alpha es 0, para que el
 * compresor no tenga que codificar color invisible. sharp reescala
 * premultiplicando el alfa, así que esto no genera halos oscuros.
 */
async function trimmed(file) {
  const { data, info } = await sharp(file)
    .trim({ threshold: 1 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) data[i] = data[i + 1] = data[i + 2] = 0;
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  });
}

async function write(pipeline, out) {
  await mkdir(dirname(out), { recursive: true });
  const info = await pipeline.flatten({ background: WHITE }).png(PNG_OPTS).toFile(out);
  return { out, ...info };
}

async function main() {
  const mark = await trimmed(MARK_SRC);
  const wordmark = await trimmed(WORDMARK_SRC);

  // Cuadrado con el isotipo centrado. 192 px cubre el tile más grande (56 px) a 3x.
  const square = (size) =>
    mark.clone().resize(size, size, { fit: "contain", background: TRANSPARENT });

  const results = await Promise.all([
    write(square(192), "public/logo-mark.png"),
    write(square(96), "src/app/icon.png"),
    write(square(180), "src/app/apple-icon.png"),
    // El lockup se muestra a 160 px de ancho como máximo; 384 lo cubre a 2x.
    write(wordmark.resize({ width: 384 }), "public/logo-wordmark.png"),
  ]);

  const sources = await Promise.all([MARK_SRC, WORDMARK_SRC].map((f) => stat(f)));
  const before = sources.reduce((a, s) => a + s.size, 0);
  const after = results.reduce((a, r) => a + r.size, 0);

  for (const r of results) {
    console.log(
      `  ${r.out.padEnd(26)} ${`${r.width}x${r.height}`.padEnd(9)} ${(r.size / 1024).toFixed(1)} KB`,
    );
  }
  console.log(
    `\n  ${(before / 1024).toFixed(0)} KB de origen → ${(after / 1024).toFixed(0)} KB publicados`,
  );
}

main();
