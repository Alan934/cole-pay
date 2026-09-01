/**
 * Genera el TP de los alumnos en Word (.docx).
 *
 * Sólo consignas: el "cómo se hace" va aparte, en la guía de uso.
 *
 *   npm i -D docx        # sólo la primera vez
 *   node scripts/build-tp-docx.mjs docs/TP-ColePay-Alumnos.docx
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
  VerticalAlign,
} from "docx";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] ?? "docs/TP-ColePay-Alumnos.docx";

const APP_URL = "https://cole-pay.sanjurjoalan.com.ar/";

/** El alumno ficticio para practicar transferencias (existe en la base real). */
const TP_USER = {
  nombre: "Tomás Ledesma",
  dni: "45.887.310",
  alias: "tomi.ledesma.tp",
  cvu: "4076663351044461346089",
};

/* ------------------------------------------------------------------ */
/* Paleta y utilidades                                                 */
/* ------------------------------------------------------------------ */

const GREEN = "0A7C5A";
const RED = "D6104A";
const GREY = "6B7280";
const DARK = "1F2933";
const LIGHT_BG = "F3F5F7";
const BOX_BG = "FAFBFC";

const FONT = "Calibri";
const PAGE_W = 9026; // ancho útil en DXA (A4 con márgenes de 2 cm)

function t(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: 21, ...opts });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 80, line: 264 },
    children: [t(text, opts.run ?? {})],
    ...opts.para,
  });
}

function kicker(text, color = DARK) {
  return new Paragraph({
    spacing: { before: 160, after: 70 },
    children: [t(text.toUpperCase(), { bold: true, size: 18, color, characterSpacing: 20 })],
  });
}

function bullets(items) {
  return items.map((text) =>
    new Paragraph({
      spacing: { after: 50, line: 264 },
      indent: { left: 300, hanging: 200 },
      children: [t("— ", { color: GREEN, bold: true }), t(text)],
    }),
  );
}

const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

/** Recuadro de una celda: para pegar la captura o para escribir. */
function box({ text, height, intro = null, shading = BOX_BG }) {
  const border = { style: BorderStyle.DASHED, size: 8, color: "9AA5B1" };
  return new Table({
    columnWidths: [PAGE_W],
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: {
      top: border, bottom: border, left: border, right: border,
      insideHorizontal: noBorder, insideVertical: noBorder,
    },
    rows: [
      new TableRow({
        cantSplit: true, // que no se parta al medio entre dos páginas
        height: { value: height, rule: "atLeast" },
        children: [
          new TableCell({
            width: { size: PAGE_W, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: shading, color: "auto" },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            verticalAlign: text ? VerticalAlign.CENTER : VerticalAlign.TOP,
            children: [
              ...(intro ?? []),
              new Paragraph({
                alignment: text ? AlignmentType.CENTER : AlignmentType.LEFT,
                children: text ? [t(text, { color: GREY, italics: true })] : [t("")],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** Renglones para completar a mano (ej. "Alias: ______"). */
function campos(items) {
  return new Paragraph({
    spacing: { after: 80, line: 264 },
    children: items.flatMap((c, i) => [
      t(i ? "     " : "", {}),
      t(`${c}: `, { bold: true }),
      t("__________________________", { color: GREY }),
    ]),
  });
}

function dataTable(rows, labelW = 3200) {
  const valueW = PAGE_W - labelW;
  const b = { style: BorderStyle.SINGLE, size: 4, color: "D9DEE4" };
  return new Table({
    columnWidths: [labelW, valueW],
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b },
    rows: rows.map(([label, value, opts = {}]) =>
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: labelW, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: LIGHT_BG, color: "auto" },
            margins: { top: 70, bottom: 70, left: 110, right: 110 },
            children: [new Paragraph({ children: [t(label, { bold: true, size: 20 })] })],
          }),
          new TableCell({
            width: { size: valueW, type: WidthType.DXA },
            margins: { top: 70, bottom: 70, left: 110, right: 110 },
            children: [
              new Paragraph({
                children: [
                  t(value, { size: 20, font: opts.mono ? "Consolas" : FONT, bold: !!opts.bold }),
                ],
              }),
            ],
          }),
        ],
      }),
    ),
  });
}

/* ------------------------------------------------------------------ */
/* Las consignas                                                       */
/* ------------------------------------------------------------------ */

const puntos = [
  {
    titulo: "Entrar a ColePay",
    consigna:
      "Entrá al sistema con el email y la contraseña que te dieron los profes.",
    captura: "la pantalla de Inicio, donde se lea «Hola, [tu nombre]».",
    preguntas: [
      "¿Por qué cada persona tiene su propio usuario y contraseña en vez de uno compartido para todo el curso?",
      "Si le prestás tu contraseña a alguien, ¿qué podría hacer con tu plata y a quién van a señalar los movimientos que queden registrados?",
    ],
  },
  {
    titulo: "Saldo, alias y CVU",
    consigna:
      "Ocultá tu saldo y volvé a mostrarlo. Copiá tu alias y tu CVU, y anotalos acá abajo.",
    campos: ["Alias", "CVU"],
    captura: "tu pantalla de Inicio con el saldo OCULTO.",
    preguntas: [
      "¿Qué es el CVU y en qué se diferencia del alias? ¿Sirven para lo mismo?",
      "¿Por qué las billeteras reales te dejan esconder el saldo? ¿Cuándo lo usarías?",
    ],
  },
  {
    titulo: "Cambiar tu alias",
    consigna:
      "Cambiá tu alias por uno con este formato: nombre.apellido.curso (por ejemplo, ana.perez.3a).",
    captura: "la pantalla de Ajustes con tu alias nuevo ya guardado.",
    preguntas: [
      "¿Por qué el sistema no deja que dos personas tengan el mismo alias?",
      "¿Qué ventaja tiene decir un alias en vez de dictar los 22 números del CVU?",
    ],
  },
  {
    titulo: "Transferir dinero",
    consigna:
      `Transferile $450 a un compañero, o a la cuenta de práctica (alias ${TP_USER.alias}). Elegí la categoría del gasto y escribí un mensaje. Antes de confirmar, leé los datos de quien va a cobrar.`,
    captura: "el cartel de «¡Transferencia exitosa!».",
    preguntas: [
      "Antes de confirmar, la app te muestra el nombre y el CUIT/DNI de quien va a recibir la plata. ¿Para qué sirve ese paso?",
      "Si el nombre que aparece no es el de la persona que esperabas, ¿qué hacés? ¿Con qué estafa real se relaciona?",
      "Una vez enviada no se puede deshacer. ¿Por qué te parece que funciona así también en los bancos?",
    ],
  },
  {
    titulo: "El comprobante",
    consigna:
      "Entrá a Actividad, abrí la transferencia del punto anterior y mirá el comprobante completo.",
    captura: "el comprobante desplegado.",
    preguntas: [
      "En ColePay los movimientos no se pueden borrar ni modificar. ¿Por qué te conviene a vos que sea así?",
      "¿Para qué te puede servir guardar un comprobante en la vida real?",
    ],
  },
  {
    titulo: "Pagar una cuenta",
    consigna:
      "Pagá una de las cuentas que te cobraron los profes. Si no tenés ninguna pendiente, pedísela.",
    captura: "la cuenta ya marcada como Pagada.",
    preguntas: [
      "¿Qué pasa si el monto es mayor que tu saldo? ¿Y en la vida real, si una cuenta vence sin pagar?",
      "¿Qué ventaja y qué riesgo tiene el débito automático?",
    ],
  },
  {
    titulo: "Cobrar: QR y pedido de cobro",
    consigna:
      "Creá un pedido de cobro por $1.200 con su motivo y mostrale a un compañero tu QR para recibir.",
    captura: "tu pedido de cobro creado, con el monto y el estado.",
    preguntas: [
      "¿Qué diferencia hay entre el QR sin monto y el pedido con monto? ¿Cuál usaría un kiosco?",
      "El pedido figura como pagado recién cuando entra la plata. ¿Por qué no se marca antes, apenas el otro dice que pagó?",
    ],
  },
  {
    titulo: "Recibir dinero y los avisos",
    consigna:
      "Pedile a un compañero que te transfiera algo (aunque sea $1) y revisá tus Avisos.",
    captura: "el aviso de dinero recibido.",
    preguntas: [
      "¿Por qué conviene tener las notificaciones activadas en una billetera real?",
      "Si te llega un aviso de un movimiento que vos no hiciste, ¿qué harías, paso por paso?",
    ],
  },
  {
    titulo: "En qué gastás",
    consigna:
      "Hacé al menos tres gastos con categorías distintas y mirá el resumen «En qué gastás» en Inicio.",
    captura: "tu resumen con al menos tres categorías.",
    preguntas: [
      "¿Para qué sirve categorizar los gastos? ¿Qué decisión podrías tomar mirando el gráfico?",
      "Si tuvieras que recortar gastos, ¿qué categoría tocarías primero y por qué?",
    ],
  },
  {
    titulo: "Meta de ahorro",
    consigna:
      "Creá una meta de ahorro y apartá una parte de tu saldo. Anotá la fecha hasta la que queda bloqueada.",
    captura: "tu meta con la barra de progreso y plata apartada.",
    preguntas: [
      "La plata apartada rinde más que el saldo disponible, pero queda bloqueada. ¿Por qué te parece que el banco paga más por eso?",
      "Ordená de más líquido a menos líquido: saldo disponible, meta de ahorro, plazo fijo.",
    ],
  },
  {
    titulo: "Plazo fijo",
    consigna:
      "Probá los distintos plazos que ofrece el banco, elegí uno y creá tu plazo fijo. Anotá cuánto vas a cobrar al vencimiento.",
    campos: ["Plazo elegido", "Cobro al vencimiento"],
    captura: "tu plazo fijo activo, con el monto y la fecha de vencimiento.",
    preguntas: [
      "Si lo rompés antes de tiempo recuperás el capital pero perdés el interés. ¿Por qué?",
      "¿Conviene poner toda tu plata a plazo fijo? Justificá pensando en las cuentas que tenés que pagar.",
    ],
  },
  {
    titulo: "La cuenta de los intereses (TNA)",
    consigna:
      "En Rendimientos, usá la calculadora con: capital $10.000, 30 días y la TNA de tu plazo fijo. Después hacé la misma cuenta a mano y compará.",
    formula: "interés = capital × (TNA ÷ 100) × (días ÷ 365)",
    cuenta: true,
    captura: "la calculadora con tus números y el paso a paso a la vista.",
    preguntas: [
      "¿Qué significa cada letra de TNA? ¿Por qué se llama «anual» si vos la usás por 30 días?",
      "La TEA siempre da más que la TNA. ¿Por qué?",
      "Si la TNA es 36,5% anual y la inflación del mismo período fue mayor, ¿tenés más plata? ¿podés comprar más cosas?",
    ],
  },
  {
    titulo: "El desafío",
    consigna: "Resolvé las cinco preguntas del Desafío hasta llegar a 5 / 5.",
    captura: "el Desafío con el contador en 5 / 5.",
    preguntas: [
      "¿Cuál de las cinco te costó más? ¿Por qué?",
      "Explicá con tus palabras la respuesta de esa pregunta, como si se la tuvieras que enseñar a alguien que no cursó.",
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Armado                                                              */
/* ------------------------------------------------------------------ */

const children = [];

/* --- Encabezado del TP --- */
const logo = readFileSync(join(ROOT, "public/logo-wordmark.png"));
const logoSize = { w: logo.readUInt32BE(16), h: logo.readUInt32BE(20) };
const kLogo = Math.min(150 / logoSize.w, 60 / logoSize.h);

children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: [
      new ImageRun({
        type: "png",
        data: logo,
        transformation: {
          width: Math.round(logoSize.w * kLogo),
          height: Math.round(logoSize.h * kLogo),
        },
      }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 40 },
    children: [t("Trabajo Práctico — ColePay", { bold: true, size: 40, color: GREEN })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [
      t("Usá tu billetera virtual · el dinero es ficticio", {
        size: 20,
        color: GREY,
        italics: true,
      }),
    ],
  }),
  dataTable(
    [
      ["Nombre y apellido", " "],
      ["Curso / división", " "],
      ["Fecha de entrega", " "],
    ],
    3200,
  ),
  kicker("Cómo se entrega"),
  ...bullets([
    "Resolvé cada punto en la app y pegá la captura que se pide en el recuadro gris (Ctrl + V).",
    "Contestá las preguntas escribiendo dentro del recuadro blanco de cada punto.",
    "La captura tiene que ser de TU cuenta: se tiene que ver tu nombre o tu alias.",
    "Guardá el archivo como TP-ColePay-TuApellido.docx y subilo al campus.",
    "Si necesitás ayuda con la app, mirá la guía de uso que está subida aparte.",
  ]),
  kicker("Datos"),
  dataTable(
    [
      ["Dirección de ColePay", APP_URL, { mono: true, bold: true }],
      ["Usuario y contraseña", "los que te dieron los profes"],
      ["Cuenta de práctica", `${TP_USER.nombre} · DNI ${TP_USER.dni}`],
      ["Alias / CVU de esa cuenta", `${TP_USER.alias} · ${TP_USER.cvu}`, { mono: true }],
    ],
    3200,
  ),
  p(
    "La cuenta de práctica es para el punto 4, por si preferís no transferirle a un compañero.",
    { run: { size: 19, italics: true, color: GREY } },
  ),
);

/* --- Los puntos --- */
puntos.forEach((punto, i) => {
  children.push(
    new Paragraph({
      keepNext: true,
      spacing: { before: 260, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GREEN, space: 3 } },
      children: [
        t(`Punto ${i + 1}. `, { bold: true, size: 24, color: GREEN }),
        t(punto.titulo, { bold: true, size: 24, color: GREEN }),
      ],
    }),
    new Paragraph({
      keepNext: true,
      spacing: { after: 90, line: 264 },
      children: [t(punto.consigna)],
    }),
  );

  if (punto.formula) {
    children.push(
      new Paragraph({
        keepNext: true,
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [t(punto.formula, { bold: true, size: 22, color: GREEN })],
      }),
    );
  }

  if (punto.campos) children.push(campos(punto.campos));

  if (punto.cuenta) {
    children.push(
      new Paragraph({
        keepNext: true,
        spacing: { after: 60 },
        children: [t("La cuenta hecha a mano:", { bold: true, size: 20 })],
      }),
      box({ text: null, height: 1000 }),
    );
  }

  children.push(
    new Paragraph({
      keepNext: true,
      spacing: { before: 120, after: 70 },
      children: [
        t("Captura a entregar: ", { bold: true, color: RED, size: 20 }),
        t(punto.captura, { size: 20 }),
      ],
    }),
    box({ text: "Pegá acá tu captura (Ctrl + V)", height: 1900 }),
    new Paragraph({ spacing: { before: 100 }, children: [t("")] }),
    box({
      text: null,
      height: punto.preguntas.length > 2 ? 1300 : 1100,
      intro: [
        new Paragraph({
          spacing: { after: 60 },
          children: [t("Para pensar", { bold: true, color: GREEN, size: 20 })],
        }),
        ...punto.preguntas.map((q, j) =>
          new Paragraph({
            spacing: { after: 50, line: 260 },
            indent: { left: 240, hanging: 240 },
            children: [
              t(`${String.fromCharCode(97 + j)}) `, { bold: true }),
              t(q, { size: 20 }),
            ],
          }),
        ),
      ],
    }),
  );
});

/* --- Cierre --- */
children.push(
  new Paragraph({
    keepNext: true,
    spacing: { before: 280, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GREEN, space: 3 } },
    children: [t("Para cerrar", { bold: true, size: 24, color: GREEN })],
  }),
  new Paragraph({
    keepNext: true,
    spacing: { after: 80, line: 264 },
    children: [
      t(
        "Escribí al menos cinco renglones: ¿qué cuidados hay que tener con una billetera virtual de verdad? Pensá en la contraseña, en confirmar a quién le transferís, en los avisos y en la plata que dejás quieta.",
      ),
    ],
  }),
  box({ text: null, height: 2400 }),
  kicker("Cómo se corrige"),
  dataTable(
    [
      ["Los 13 puntos hechos, con su captura", "60 puntos"],
      ["Respuestas de «Para pensar»", "30 puntos"],
      ["Prolijidad y entrega en fecha", "10 puntos"],
      ["Total", "100 puntos"],
    ],
    6000,
  ),
);

const doc = new Document({
  creator: "ColePay",
  title: "Trabajo Práctico — ColePay",
  description: "Consignas del TP de billetera virtual",
  styles: { default: { document: { run: { font: FONT, size: 21, color: DARK } } } },
  sections: [
    {
      properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "D9DEE4", space: 4 },
              },
              children: [t("TP ColePay", { size: 17, color: GREY })],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                t("Página ", { size: 17, color: GREY }),
                new TextRun({ children: [PageNumber.CURRENT], size: 17, color: GREY, font: FONT }),
                t(" de ", { size: 17, color: GREY }),
                new TextRun({
                  children: [PageNumber.TOTAL_PAGES],
                  size: 17,
                  color: GREY,
                  font: FONT,
                }),
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
