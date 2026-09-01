/**
 * Guía rápida de los alumnos ("ColePay en 9 pantallas") en Word (.docx).
 *
 * Mismo contenido que la guía en PDF, en un archivo editable. Las capturas
 * salen de `e2e/zz-guide-short.spec.ts` y las marcas rojas las dibuja
 * `scripts/annotate-shots.mjs`:
 *
 *   SHOTS_DIR=guiashots npx playwright test e2e/zz-guide-short.spec.ts
 *   node scripts/annotate-shots.mjs guiashots
 *   node scripts/build-guia-docx.mjs guiashots/anotadas docs/ColePay-Guia.docx
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document,
  Packer,
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
  Header,
  Footer,
  PageNumber,
  PageBreak,
  TabStopType,
  VerticalAlign,
  ExternalHyperlink,
} from "docx";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.argv[2] ?? "guiashots/anotadas";
const OUT = process.argv[3] ?? "docs/ColePay-Guia.docx";

const APP_URL = "https://cole-pay.sanjurjoalan.com.ar/";
const APP_URL_CORTA = "cole-pay.sanjurjoalan.com.ar";

/* ------------------------------------------------------------------ */
/* Paleta                                                              */
/* ------------------------------------------------------------------ */

const INK = "111827";
const GREEN = "0A7C5A";
const GREEN_BADGE = "0FA36B";
const GREEN_TINT = "E9F7F1";
const RED = "D6104A";
const RED_TINT = "FDEEF1";
const GREY = "6B7280";
const LINE = "E2E6EA";

const FONT = "Calibri";
const PAGE_W = 9026; // ancho útil en DXA (A4, márgenes de 2 cm)

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function t(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: 21, color: INK, ...opts });
}

function p(text, opts = {}) {
  return new Paragraph({
    keepNext: opts.keepNext ?? true,
    spacing: { after: 100, line: 276 },
    children: [t(text, opts.run ?? {})],
    ...opts.para,
  });
}

/** Párrafo con partes de distinto formato: [["texto", {bold:true}], …] */
function rich(parts, para = {}) {
  return new Paragraph({
    spacing: { after: 100, line: 276 },
    children: parts.map(([text, opts = {}]) => t(text, opts)),
    ...para,
  });
}

function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** ImageRun escalado para entrar en una caja. */
function imageRun(name, maxW, maxH) {
  const data = readFileSync(join(SHOTS, `${name}.png`));
  const { w, h } = pngSize(data);
  const k = Math.min(maxW / w, maxH / h, 1);
  return new ImageRun({
    type: "png",
    data,
    transformation: { width: Math.round(w * k), height: Math.round(h * k) },
  });
}

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allNone = {
  top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
  insideHorizontal: noBorder, insideVertical: noBorder,
};

/** Título de sección: "3 de 9  Moverte por la app  → dónde está". */
function sectionTitle(n, title, chip) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 300, after: 90 },
    children: [
      new TextRun({
        text: ` ${n} de 9 `,
        font: FONT,
        size: 18,
        bold: true,
        color: "FFFFFF",
        shading: { type: ShadingType.CLEAR, fill: GREEN_BADGE, color: "auto" },
      }),
      t("  ", {}),
      t(title, { bold: true, size: 30 }),
      t("   ", {}),
      new TextRun({
        text: ` → ${chip} `,
        font: FONT,
        size: 17,
        bold: true,
        color: GREEN,
        shading: { type: ShadingType.CLEAR, fill: GREEN_TINT, color: "auto" },
      }),
    ],
  });
}

/** Bloque destacado con barra de color a la izquierda. */
function callout(parts, tone = "green") {
  const barColor = tone === "red" ? RED : GREEN_BADGE;
  const fill = tone === "red" ? RED_TINT : GREEN_TINT;
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
}

/** Captura a la izquierda y la lista de marcas a la derecha. */
function shotWithLegend(name, labels, { imgW = 290, imgH = 470 } = {}) {
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
              new Paragraph({ spacing: { after: 0 }, children: [imageRun(name, imgW, imgH)] }),
            ],
          }),
          new TableCell({
            width: { size: right, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            margins: { top: 40, bottom: 40, left: 60, right: 0 },
            children: labels.map((label, i) =>
              new Paragraph({
                spacing: { after: 90, line: 264 },
                indent: { left: 300, hanging: 300 },
                children: [
                  t(`${CIRCLED[i]} `, { color: RED, bold: true, size: 24 }),
                  t(label, { size: 21 }),
                ],
              }),
            ),
          }),
        ],
      }),
    ],
  });
}

/** Captura ancha (la barra de navegación) con las marcas debajo, en una línea. */
function wideShot(name, labels, maxW = 560) {
  return [
    new Paragraph({
      keepNext: true,
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 80 },
      children: [imageRun(name, maxW, 200)],
    }),
    new Paragraph({
      spacing: { after: 120 },
      alignment: AlignmentType.CENTER,
      children: labels.flatMap((label, i) => [
        t(`${CIRCLED[i]} `, { color: RED, bold: true, size: 24 }),
        t(`${label}    `, { size: 21 }),
      ]),
    }),
  ];
}

/** Fila de tarjetitas con título y bajada. */
function cardRow(cards) {
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
}

/** Tabla de dos columnas (glosario, atajos). */
function defTable(rows, labelW = 2000) {
  const valueW = PAGE_W - labelW;
  const b = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  return new Table({
    columnWidths: [labelW, valueW],
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: noBorder },
    rows: rows.map(([label, parts]) =>
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: labelW, type: WidthType.DXA },
            margins: { top: 90, bottom: 90, left: 140, right: 100 },
            children: [new Paragraph({ children: [t(label, { bold: true, size: 21 })] })],
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
}

function h2(text) {
  return new Paragraph({
    keepNext: true,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 140 },
    children: [t(text, { bold: true, size: 30 })],
  });
}

const mono = { font: "Consolas", size: 20 };

/* ------------------------------------------------------------------ */
/* Contenido                                                           */
/* ------------------------------------------------------------------ */

const children = [];

/* --- Tapa --- */
const logo = readFileSync(join(ROOT, "public/logo-wordmark.png"));
const ls = pngSize(logo);
const kLogo = Math.min(150 / ls.w, 55 / ls.h);

children.push(
  new Paragraph({
    spacing: { after: 120 },
    children: [
      new ImageRun({
        type: "png",
        data: logo,
        transformation: { width: Math.round(ls.w * kLogo), height: Math.round(ls.h * kLogo) },
      }),
    ],
  }),
  new Paragraph({
    heading: HeadingLevel.TITLE,
    spacing: { after: 120 },
    children: [t("ColePay en 9 pantallas", { bold: true, size: 52 })],
  }),
  p("Tu primera billetera electrónica. Mirá las fotos: lo importante está marcado en rojo.", {
    run: { size: 23, color: "374151" },
  }),
  new Paragraph({ spacing: { after: 80 }, children: [t("")] }),
  cardRow([
    ["Plata ficticia", "No es dinero real ni se puede sacar."],
    ["Te la dan los profes", "No te registrás: te dan usuario y contraseña."],
    ["Se cierra sola", "A los 15 minutos sin usarla. Volvés a entrar."],
  ]),
);

/* --- 1. Entrar --- */
children.push(
  new Paragraph({
    keepNext: true,
    spacing: { before: 300, after: 90 },
    children: [
      new TextRun({
        text: " 1 de 9 ",
        font: FONT,
        size: 18,
        bold: true,
        color: "FFFFFF",
        shading: { type: ShadingType.CLEAR, fill: GREEN_BADGE, color: "auto" },
      }),
      t("  ", {}),
      t("Entrar", { bold: true, size: 30 }),
      t("   ", {}),
      new ExternalHyperlink({
        link: APP_URL,
        children: [
          new TextRun({
            text: ` → ${APP_URL_CORTA} `,
            font: FONT,
            size: 17,
            bold: true,
            color: GREEN,
            shading: { type: ShadingType.CLEAR, fill: GREEN_TINT, color: "auto" },
          }),
        ],
      }),
    ],
  }),
  p("Escribí el email y la contraseña que te dieron, tal cual, sin espacios."),
  shotWithLegend("s1-entrar", ["Tu email", "Tu contraseña", "Entrar"], { imgW: 290, imgH: 470 }),
  callout(
    [
      ["¿No entra? ", { bold: true, color: RED }],
      [
        "Fijate que el email esté completo y sin espacios al final. Si sigue sin andar, avisales a los profes.",
      ],
    ],
    "red",
  ),
);

/* --- 2. Tu tarjeta --- */
children.push(
  sectionTitle(2, "Tu tarjeta", "Inicio"),
  p("Es lo primero que ves. Tiene los tres datos que vas a usar siempre."),
  shotWithLegend(
    "s2-tarjeta",
    ["Lo que podés gastar", "Tu nombre corto", "Tu número de cuenta", "Esconde el saldo"],
    { imgW: 300, imgH: 260 },
  ),
  callout([
    ["Tocá el alias o el CVU y se copian solos. ", { bold: true, color: GREEN }],
    ["Después los pegás en el chat del curso: no hace falta dictarlos."],
  ]),
);

/* --- 3. Moverte por la app --- */
children.push(
  sectionTitle(3, "Moverte por la app", "Abajo de todo, siempre"),
  p("Estos cinco botones te llevan a todo. El globito verde avisa cuántos avisos no leíste."),
  ...wideShot("s3-barra", ["Inicio", "Enviar", "Pagar", "Avisos", "Ajustes"]),
  defTable(
    [
      ["Inicio", "Tu saldo, el resumen de todo y los atajos a Metas, Plazo fijo y Cobrar."],
      ["Enviar", "Transferirle plata a un compañero con su alias."],
      ["Pagar", "Las cuentas que te cargaron los profes."],
      ["Avisos", "Cuando te llega plata, te cobran algo o ganás intereses."],
      ["Ajustes", "Tus datos, cambiar el alias y cerrar sesión."],
    ],
    1700,
  ),
);

/* --- 4. Enviar dinero --- */
children.push(
  sectionTitle(4, "Enviar dinero", "Barra de abajo · Enviar"),
  p("Para pagarle a un compañero. Le pedís el alias, ponés el monto y listo."),
  shotWithLegend(
    "s4-enviar",
    ["Alias de quien cobra", "Cuánto mandás", "Para qué es el gasto", "Continuar"],
    { imgW: 300, imgH: 420 },
  ),
  callout(
    [
      ["Esto no se puede deshacer. ", { bold: true, color: RED }],
      [
        "Si le mandás la plata a la persona equivocada, no hay botón para cancelar: ni vos ni los profes pueden volverla atrás. Hay que pedirle que te la devuelva. ",
      ],
      [
        "Cuando tocás Continuar, la app te muestra el nombre y el DNI de quien va a cobrar: leelo antes de tocar Confirmar.",
        { bold: true, color: RED },
      ],
    ],
    "red",
  ),
  callout([
    ["Si dice "],
    ["“saldo insuficiente”", { bold: true }],
    [
      ", no te alcanza la plata suelta. Fijate si no la tenés guardada en una meta o en un plazo fijo.",
    ],
  ]),
);

/* --- 5. Pagar tus cuentas --- */
children.push(
  sectionTitle(5, "Pagar tus cuentas", "Barra de abajo · Pagar"),
  p("Los cobros que te cargan los profes: alquiler del stand, luz, lo que definan en clase."),
  shotWithLegend("s5-pagar", ["Qué te cobran", "Cuándo vence", "Pagar"], {
    imgW: 300,
    imgH: 150,
  }),
  callout([
    ["Estas cuentas se repiten cada semana. "],
    ["Guardá la plata antes de gastarla", { bold: true, color: GREEN }],
    [": si no te alcanza el día que vence, no la podés pagar."],
  ]),
);

/* --- 6. Cobrar con QR --- */
children.push(
  sectionTitle(6, "Cobrar con QR", "Inicio · Cobrar"),
  p("Al revés que enviar: mostrás el código y el otro escanea. Ideal para vender en el stand."),
  shotWithLegend("s6-cobrar", ["Que lo escaneen", "Te pagan a este alias"], {
    imgW: 300,
    imgH: 300,
  }),
  callout([
    ["Más abajo, en la misma pantalla, podés "],
    ["pedir un monto exacto", { bold: true, color: GREEN }],
    [
      ": ponés cuánto y para qué, y te arma un QR y un link para mandar por chat. Te queda en una lista con su estado.",
    ],
  ]),
  callout(
    [
      ["Te pagaron cuando la app dice “Pagado”. ", { bold: true, color: RED }],
      ["Que te digan “ya te mandé” no cuenta: mirá el estado del pedido."],
    ],
    "red",
  ),
);

/* --- 7. Metas de ahorro --- */
children.push(
  sectionTitle(7, "Metas de ahorro", "Inicio · Metas"),
  p("Apartás plata para algo. Sigue siendo tuya, pero rinde más que suelta."),
  shotWithLegend(
    "s7-metas",
    ["Cuánto llevás", "Lo que gana sola por día", "Hasta cuándo no se toca", "Guardar / sacar plata"],
    { imgW: 300, imgH: 260 },
  ),
);

/* --- 8. Plazo fijo --- */
children.push(
  sectionTitle(8, "Plazo fijo", "Inicio · Plazo fijo"),
  p(
    "Dejás la plata quieta una cantidad de días y el banco te paga más. Antes de confirmar te muestra la cuenta.",
  ),
  shotWithLegend(
    "s8-plazo",
    ["Cuánto invertís", "Por cuántos días", "Lo que vas a cobrar", "Confirmar"],
    { imgW: 300, imgH: 420 },
  ),
  callout(
    [
      ["Si lo rompés antes de tiempo, perdés todo el interés. ", { bold: true, color: RED }],
      ["Recuperás lo que pusiste y nada más. Invertí sólo lo que no vas a necesitar."],
    ],
    "red",
  ),
);

/* --- 9. Que tu plata crezca sola --- */
children.push(
  sectionTitle(9, "Que tu plata crezca sola", "Inicio · Tu plata está generando"),
  p("El banco te paga por dejar la plata quieta. Cuanto menos la tocás, más te paga."),
  shotWithLegend(
    "s9-rendimientos",
    ["Suelta rinde poco", "Guardada rinde más", "Lo que ganaste sin hacer nada"],
    { imgW: 300, imgH: 260 },
  ),
  callout([
    ["En esa pantalla hay una "],
    ["calculadora", { bold: true, color: GREEN }],
    [" para probar con tus números y un "],
    ["desafío", { bold: true, color: GREEN }],
    [" de cinco preguntas. Se puede reintentar sin límite."],
  ]),
);

/* --- Cierre --- */
children.push(
  // El cierre entero en una hoja: queda para pegar en la carpeta.
  new Paragraph({ children: [new PageBreak()] }),
  h2("Cuatro reglas de oro"),
  cardRow([
    [
      "La contraseña no se comparte",
      "Todo lo que se haga desde tu cuenta figura como hecho por vos.",
    ],
    ["Revisá el alias dos veces", "Una letra cambiada manda la plata a otra persona, y no hay vuelta atrás."],
  ]),
  new Paragraph({ spacing: { after: 100 }, children: [t("")] }),
  cardRow([
    ["Primero lo que debés", "Mirá Pagar antes de gastar. Esa plata ya no es tuya."],
    ["Cerrá sesión", "En Ajustes · Salir, sobre todo si la compu es compartida."],
  ]),
  h2("Cuatro palabras"),
  defTable([
    ["Saldo", "La plata que podés gastar ahora. No incluye metas ni plazos fijos."],
    [
      "Alias",
      [
        ["Tu nombre corto para que te paguen, tipo "],
        ["sofia.sol.mar", mono],
        ["."],
      ],
    ],
    ["CVU", "El número largo de tu cuenta. Sirve para lo mismo que el alias."],
    ["Interés", "Lo que te paga el banco por dejar la plata quieta."],
  ]),
);

/* ------------------------------------------------------------------ */

const doc = new Document({
  creator: "ColePay",
  title: "ColePay en 9 pantallas — Guía rápida",
  description: "Guía de uso de ColePay para alumnos",
  styles: { default: { document: { run: { font: FONT, size: 21, color: INK } } } },
  sections: [
    {
      properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [t("Plata ficticia, sin valor real", { size: 17, color: GREY })],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 6 } },
              tabStops: [{ type: TabStopType.RIGHT, position: PAGE_W }],
              children: [
                t("ColePay · Guía rápida", { size: 17, color: GREY }),
                t("\t", {}),
                new TextRun({ children: [PageNumber.CURRENT], size: 17, color: GREY, font: FONT }),
              ],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
writeFileSync(OUT, buffer);
console.log(`✅ ${OUT} (${(buffer.length / 1024).toFixed(0)} KB)`);
