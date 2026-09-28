/**
 * Piezas compartidas por los generadores de guías en Word.
 *
 * Son las mismas que usa `build-guia-docx.mjs` (tapa, títulos de sección con
 * chapita, capturas con leyenda numerada, callouts, tablas), empaquetadas para
 * que las dos guías de quinto —la del mostrador y la de la profe— salgan
 * idénticas en estilo sin duplicar 300 líneas.
 *
 *   const k = createKit({ shotsDir: "quintoshots/anotadas", accent: "..." });
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  AlignmentType,
  HeadingLevel,
  VerticalAlign,
} from "docx";

export const INK = "111827";
export const GREY = "6B7280";
export const LINE = "E2E6EA";
export const RED = "D6104A";
export const RED_TINT = "FDEEF1";
export const FONT = "Calibri";
/** Ancho útil en DXA (A4 con márgenes de 2 cm). */
export const PAGE_W = 9026;
/** Ese mismo ancho, en píxeles, que es la unidad de las imágenes. */
export const PAGE_PX = 600;

export const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
export const allNone = {
  top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
  insideHorizontal: noBorder, insideVertical: noBorder,
};

export function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/**
 * @param shotsDir carpeta con las capturas ya anotadas
 * @param accent   color de la marca de agua del documento (hex sin #)
 * @param tint     fondo suave del mismo color
 * @param steps    cuántas secciones tiene la guía (para "3 de 9")
 */
export function createKit({ shotsDir, accent, tint, steps }) {
  const t = (text, opts = {}) =>
    new TextRun({ text, font: FONT, size: 21, color: INK, ...opts });

  const p = (text, opts = {}) =>
    new Paragraph({
      keepNext: opts.keepNext ?? true,
      spacing: { after: 100, line: 276 },
      children: [t(text, opts.run ?? {})],
      ...opts.para,
    });

  const rich = (parts, para = {}) =>
    new Paragraph({
      spacing: { after: 100, line: 276 },
      children: parts.map(([text, opts = {}]) => t(text, opts)),
      ...para,
    });

  /** ImageRun escalado para entrar en una caja. */
  const imageRun = (name, maxW, maxH) => {
    const data = readFileSync(join(shotsDir, `${name}.png`));
    const { w, h } = pngSize(data);
    const k = Math.min(maxW / w, maxH / h);
    return new ImageRun({
      type: "png",
      data,
      transformation: { width: Math.round(w * k), height: Math.round(h * k) },
    });
  };

  const h2 = (text) =>
    new Paragraph({
      keepNext: true,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 320, after: 140 },
      children: [t(text, { bold: true, size: 30 })],
    });

  /** Título de sección: "3 de 9  Cobrar un cheque  → Cheques". */
  const sectionTitle = (n, title, chip) =>
    new Paragraph({
      keepNext: true,
      spacing: { before: 300, after: 90 },
      children: [
        new TextRun({
          text: ` ${n} de ${steps} `,
          font: FONT,
          size: 18,
          bold: true,
          color: "FFFFFF",
          shading: { type: ShadingType.CLEAR, fill: accent, color: "auto" },
        }),
        t("  ", {}),
        t(title, { bold: true, size: 30 }),
        t("   ", {}),
        new TextRun({
          text: ` → ${chip} `,
          font: FONT,
          size: 17,
          bold: true,
          color: accent,
          shading: { type: ShadingType.CLEAR, fill: tint, color: "auto" },
        }),
      ],
    });

  /** Bloque destacado con barra de color a la izquierda. */
  const callout = (parts, tone = "accent") => {
    const barColor = tone === "red" ? RED : accent;
    const fill = tone === "red" ? RED_TINT : tint;
    return new Table({
      columnWidths: [PAGE_W],
      width: { size: PAGE_W, type: WidthType.DXA },
      borders: {
        ...allNone,
        left: { style: BorderStyle.SINGLE, size: 18, color: barColor },
      },
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: PAGE_W, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill, color: "auto" },
              margins: { top: 120, bottom: 120, left: 160, right: 160 },
              children: [
                new Paragraph({
                  spacing: { line: 276 },
                  children: parts.map(([text, opts = {}]) => t(text, opts)),
                }),
              ],
            }),
          ],
        }),
      ],
    });
  };

  const legendPara = (label, i, opts = {}) =>
    new Paragraph({
      spacing: { after: 80, line: 264 },
      indent: { left: 300, hanging: 300 },
      children: [
        t(`${CIRCLED[i]} `, { color: RED, bold: true, size: 24 }),
        t(label, { size: opts.size ?? 21 }),
      ],
    });

  /** Captura angosta a la izquierda y la leyenda numerada a la derecha. */
  const shotWithLegend = (name, labels, { imgW = 300, imgH = 470 } = {}) => {
    const left = 4300;
    const right = PAGE_W - left;
    return new Table({
      columnWidths: [left, right],
      width: { size: PAGE_W, type: WidthType.DXA },
      borders: allNone,
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: left, type: WidthType.DXA },
              margins: { top: 40, bottom: 40, left: 0, right: 120 },
              children: [
                new Paragraph({
                  spacing: { after: 0 },
                  children: [imageRun(name, imgW, imgH)],
                }),
              ],
            }),
            new TableCell({
              width: { size: right, type: WidthType.DXA },
              verticalAlign: VerticalAlign.TOP,
              margins: { top: 40, bottom: 40, left: 60, right: 0 },
              children: labels.map((label, i) => legendPara(label, i)),
            }),
          ],
        }),
      ],
    });
  };

  /** Captura ancha arriba y la leyenda en dos columnas abajo. */
  const wideShot = (name, labels, { maxW = PAGE_PX, maxH = 780 } = {}) => {
    const img = new Paragraph({
      keepNext: true,
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 100 },
      children: [imageRun(name, maxW, maxH)],
    });
    // Hay capturas que se leen solas (la barra de secciones): ahí la leyenda
    // numerada sobra y la tabla vacía sólo dejaría un hueco.
    if (!labels.length) return [img];

    const half = Math.ceil(labels.length / 2);
    const cols = [labels.slice(0, half), labels.slice(half)];
    const w = Math.floor(PAGE_W / 2);
    return [
      img,
      new Table({
        columnWidths: [w, w],
        width: { size: PAGE_W, type: WidthType.DXA },
        borders: allNone,
        rows: [
          new TableRow({
            cantSplit: true,
            children: cols.map((col, c) =>
              new TableCell({
                width: { size: w, type: WidthType.DXA },
                verticalAlign: VerticalAlign.TOP,
                margins: { top: 40, bottom: 40, left: c === 0 ? 0 : 140, right: 100 },
                children: col.length
                  ? col.map((label, i) => legendPara(label, i + c * half, { size: 20 }))
                  : [new Paragraph({ children: [t("")] })],
              }),
            ),
          }),
        ],
      }),
    ];
  };

  /**
   * Elige sola la forma de la captura: las anchas van arriba con la leyenda
   * debajo, las verticales al costado.
   */
  const shot = (name, labels, opts = {}) => {
    const { w, h } = pngSize(readFileSync(join(shotsDir, `${name}.png`)));
    if (w / h >= 1.5 || opts.wide) {
      return wideShot(name, labels, opts);
    }
    return [shotWithLegend(name, labels, opts)];
  };

  /** Fila de tarjetitas con título y bajada. */
  const cardRow = (cards) => {
    const w = Math.floor(PAGE_W / cards.length);
    const b = { style: BorderStyle.SINGLE, size: 4, color: LINE };
    return new Table({
      columnWidths: cards.map(() => w),
      width: { size: w * cards.length, type: WidthType.DXA },
      borders: { ...allNone },
      rows: [
        new TableRow({
          cantSplit: true,
          children: cards.map(([title, body]) =>
            new TableCell({
              width: { size: w, type: WidthType.DXA },
              borders: { top: b, bottom: b, left: b, right: b },
              margins: { top: 120, bottom: 120, left: 140, right: 140 },
              children: [
                new Paragraph({
                  spacing: { after: 60 },
                  children: [t(title, { bold: true, size: 21 })],
                }),
                new Paragraph({
                  spacing: { line: 264 },
                  children: [t(body, { size: 19, color: "374151" })],
                }),
              ],
            }),
          ),
        }),
      ],
    });
  };

  /** Tabla de dos columnas (glosario, atajos, checklist). */
  const defTable = (rows, labelW = 2200) => {
    const valueW = PAGE_W - labelW;
    const b = { style: BorderStyle.SINGLE, size: 4, color: LINE };
    return new Table({
      columnWidths: [labelW, valueW],
      width: { size: PAGE_W, type: WidthType.DXA },
      borders: {
        top: b, bottom: b, left: b, right: b,
        insideHorizontal: b, insideVertical: noBorder,
      },
      rows: rows.map(([label, parts]) =>
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: labelW, type: WidthType.DXA },
              margins: { top: 90, bottom: 90, left: 140, right: 100 },
              children: [
                new Paragraph({ children: [t(label, { bold: true, size: 21 })] }),
              ],
            }),
            new TableCell({
              width: { size: valueW, type: WidthType.DXA },
              margins: { top: 90, bottom: 90, left: 100, right: 140 },
              children: [
                new Paragraph({
                  spacing: { line: 264 },
                  children: (typeof parts === "string" ? [[parts, {}]] : parts).map(
                    ([text, opts = {}]) => t(text, { size: 21, ...opts }),
                  ),
                }),
              ],
            }),
          ],
        }),
      ),
    });
  };

  return {
    t, p, rich, imageRun, h2, sectionTitle, callout, shot, shotWithLegend,
    wideShot, cardRow, defTable,
  };
}
