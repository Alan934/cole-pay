/**
 * Guía del mostrador para los alumnos de quinto ("El banco en 10 pantallas").
 *
 * Casi todo son capturas anotadas: el texto está para leer la foto, no al
 * revés. Las capturas salen de `e2e/zz-quinto-shots.spec.ts` y las marcas
 * rojas las dibuja `scripts/annotate-shots.mjs`:
 *
 *   SHOTS_DIR=quintoshots npx playwright test e2e/zz-quinto-shots.spec.ts
 *   node scripts/annotate-shots.mjs quintoshots
 *   node scripts/build-quinto-alumnos-docx.mjs quintoshots/anotadas docs/ColePay-Quinto-Alumnos.docx
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
  BorderStyle,
  AlignmentType,
  HeadingLevel,
  Header,
  Footer,
  PageNumber,
  PageBreak,
  TabStopType,
} from "docx";
import {
  createKit,
  pngSize,
  FONT,
  GREY,
  LINE,
  PAGE_W,
  RED,
} from "./lib/docx-kit.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.argv[2] ?? "quintoshots/anotadas";
const OUT = process.argv[3] ?? "docs/ColePay-Quinto-Alumnos.docx";

const VIOLET = "5B3FD1";
const VIOLET_TINT = "EFEBFB";

const k = createKit({
  shotsDir: SHOTS,
  accent: VIOLET,
  tint: VIOLET_TINT,
  steps: 10,
});
const { p, sectionTitle, callout, shot, cardRow, defTable, h2, t } = k;
const mono = { font: "Consolas", size: 20 };

const children = [];

/* ------------------------------ Tapa -------------------------------- */

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
        transformation: {
          width: Math.round(ls.w * kLogo),
          height: Math.round(ls.h * kLogo),
        },
      }),
    ],
  }),
  new Paragraph({
    heading: HeadingLevel.TITLE,
    spacing: { after: 120 },
    children: [t("El banco en 10 pantallas", { bold: true, size: 52 })],
  }),
  p("Ustedes atienden el banco. Miren las fotos: lo importante está marcado en rojo.", {
    run: { size: 23, color: "374151" },
  }),
  new Paragraph({ spacing: { after: 80 }, children: [t("")] }),
  cardRow([
    ["Ustedes son el banco", "No tienen billetera propia: manejan la caja del banco."],
    ["Los clientes son los de tercero", "Les piden tarjetas, préstamos, cheques y efectivo."],
    ["La caja es el límite", "Si se quedan sin plata, el banco deja de funcionar."],
  ]),
);

/* --- 1. Entrar --- */
children.push(
  sectionTitle(1, "Entrar", "La dirección de ColePay"),
  p("Con el email y la contraseña que les dieron los profes entran directo al mostrador de su banco."),
  ...shot("q1-entrar", ["El email que les dieron", "La contraseña", "Entrar al mostrador"], {
    imgW: 280,
    imgH: 220,
  }),
  callout([
    ["El nombre del banco aparece arriba, al lado del logo. ", { bold: true, color: VIOLET }],
    ["Si dice “Sin banco”, avisen: todavía no los asignaron a ningún equipo."],
  ]),
);

/* --- 2. Moverte por el banco --- */
children.push(
  sectionTitle(2, "Moverse por el banco", "La barra de arriba"),
  p("Ocho secciones. El globito amarillo avisa cuántas cosas hay esperando."),
  ...shot("q2-menu", []),
  defTable([
    ["Mostrador", "El resumen del día: caja, pendientes y últimos movimientos."],
    ["Solicitudes", "Los que piden tarjeta. Ustedes deciden si se la dan y con qué límite."],
    ["Tarjetas", "Las que ya emitieron: cambiar el límite, bloquear, cerrar el resumen."],
    ["Préstamos", "Los que piden plata en cuotas."],
    ["Cheques", "Cobrar o rechazar los cheques que traen al banco."],
    ["Ventanilla", "Recibir y entregar billetes."],
    ["Plazos fijos", "La pizarra de tasas: lo que pagan por la plata que les dejan."],
    ["Cuenta", "Todo lo que entró y salió de la caja."],
  ]),
);

/* --- 3. Los números del mostrador --- */
children.push(
  sectionTitle(3, "Los números del mostrador", "Mostrador"),
  p("Los cinco números que hay que mirar apenas entran."),
  ...shot("q3-mostrador", [
    "La plata que tienen",
    "Lo que está afuera",
    "Pedidos sin contestar",
    "Tarjetas que emitieron",
    "Clientes que no pagaron",
  ], { wide: true }),
  callout(
    [
      ["Si la caja llega a cero, el banco se frena. ", { bold: true, color: RED }],
      ["Las compras con tarjeta de sus clientes se rechazan, no pueden desembolsar préstamos y no les alcanza para pagar una extracción por ventanilla."],
    ],
    "red",
  ),
);

/* --- 4. Dar una tarjeta --- */
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  sectionTitle(4, "Dar una tarjeta", "Solicitudes"),
  p("Primero miran quién pide y con qué respaldo. No están obligados a dar lo que piden."),
  ...shot("q4-solicitud", [
    "Quién la pide y de qué curso",
    "Cuánto pide",
    "Con qué plata cuenta",
    "Para qué la quiere",
    "Aprobar o rechazar",
  ], { wide: true }),
  p("Si aprueban, cargan los datos del plástico que ya tienen en el aula."),
  ...shot("q5-emitir", [
    "El límite que le dan ustedes",
    "Marca del plástico",
    "Copiar los datos del plástico",
    "Los 16 números de la tarjeta",
    "Nombre impreso y vencimiento",
    "Queda emitida",
  ], { wide: true }),
  callout([
    ["Los datos tienen que coincidir con la tarjeta de cartón. ", { bold: true, color: VIOLET }],
    ["El número se valida como uno real: si está mal tipeado, no deja emitirla."],
  ]),
);

/* --- 5. Cobrar lo que prestaron --- */
children.push(
  sectionTitle(5, "Cobrar la tarjeta", "Tarjetas"),
  p("Cada consumo lo adelanta el banco. El resumen es la forma de recuperarlo."),
  ...shot("q6-tarjetas", [
    "El cliente",
    "Cuánto debe hoy",
    "Subir o bajar el límite",
    "Bloquear la tarjeta",
    "Emitir el resumen",
  ], { wide: true }),
  callout([
    ["Cerrar el período emite el resumen ", { bold: true, color: VIOLET }],
    ["y le llega al cliente con su fecha de vencimiento. Si no paga, entra en mora y el banco le cobra interés."],
  ]),
);

/* --- 6. Prestar plata --- */
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  sectionTitle(6, "Prestar plata", "Préstamos"),
  p("Ustedes eligen cuánto, a qué interés y en cuántas cuotas. La cuenta se ve antes de firmar."),
  ...shot("q7-prestamo", [
    "Capital que sale de la caja",
    "Interés por mes",
    "En cuántas cuotas",
    "La cuenta hecha: la ganancia del banco",
    "Le sale la plata",
  ], { wide: true }),
  callout(
    [
      ["El capital sale de la caja en el momento. ", { bold: true, color: RED }],
      ["Vuelve de a poco, en cuotas. Presten mirando lo que les queda para atender al resto."],
    ],
    "red",
  ),
);

/* --- 7. Cheques --- */
children.push(
  sectionTitle(7, "Cobrar un cheque", "Cheques"),
  p("Viene el beneficiario con el papel. Antes de pagar, miran si el que lo firmó tiene la plata."),
  ...shot("q8-cheque", [
    "Importe y número del papel",
    "Quién lo firmó y para quién es",
    "Si el que firmó tiene la plata",
    "Pagarlo",
    "No pagarlo",
  ], { wide: true }),
  callout(
    [
      ["Sin fondos, el cheque rebota. ", { bold: true, color: RED }],
      ["Queda registrado en el historial del que lo firmó y todos los bancos lo ven. Un cheque diferido no se paga antes de su fecha."],
    ],
    "red",
  ),
  p("Si el cheque no está cargado en el sistema, lo cargan ustedes con el papel a la vista."),
  ...shot("q9-cheque-alta", [
    "Lo que se queda el banco",
    "Número del papel",
    "Importe",
    "Quién lo firmó",
    "A la orden de quién",
    "Desde cuándo se puede cobrar",
  ], { wide: true }),
  callout([
    ["Nunca lo carga el que lo viene a cobrar. ", { bold: true, color: VIOLET }],
    ["Lo carga el que lo firmó, o ustedes con el papel delante."],
  ]),
);

/* --- 8. Ventanilla --- */
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  sectionTitle(8, "La ventanilla", "Ventanilla"),
  p("Entran y salen billetes. Cuenten primero, carguen después."),
  ...shot("q10-ventanilla", [
    "A quién atienden",
    "Cuántos billetes contaron",
    "De dónde salió esa plata",
    "Entra a la caja",
  ], { wide: true }),
  callout([
    ["El depósito suma a la caja del banco y a la cuenta del cliente. ", { bold: true, color: VIOLET }],
    ["La extracción resta de las dos. Si prestaron de más, no les va a alcanzar para pagar un retiro."],
  ]),
);

/* --- 9. Plazos fijos --- */
children.push(
  sectionTitle(9, "La pizarra de tasas", "Plazos fijos"),
  p("Es la plata que les dejan guardada. Entra a la caja y la pueden prestar… pero hay que devolverla con interés."),
  ...shot("q11-plazos", [
    "Lo que pagan contra lo que cobran",
    "Los plazos que ofrecen hoy",
    "Por cuántos días",
    "Cuánto pagan por año (TNA)",
    "Queda en la pizarra",
  ], { wide: true }),
  callout(
    [
      ["Nunca paguen más de lo que cobran prestando. ", { bold: true, color: RED }],
      ["Ahí está la ganancia del banco: la diferencia entre las dos tasas."],
    ],
    "red",
  ),
);

/* --- 10. La cuenta --- */
children.push(
  sectionTitle(10, "La cuenta del banco", "Cuenta"),
  p("Todo lo que hicieron en el día, en una lista. Acá se ve si el banco gana o pierde."),
  ...shot("q12-cuenta", [
    "Lo que hay ahora",
    "Todo lo que entró",
    "Todo lo que salió",
  ], { wide: true }),
);

/* ------------------------------ Cierre ------------------------------- */

children.push(
  new Paragraph({ children: [new PageBreak()] }),
  h2("Cuatro reglas del mostrador"),
  cardRow([
    ["Miren la caja antes de decir que sí", "Prestar es fácil; pagar cuando vengan todos juntos, no."],
    ["Lo que aprueban queda a su nombre", "Cada decisión guarda quién la tomó. No presten la contraseña."],
  ]),
  new Paragraph({ spacing: { after: 100 }, children: [t("")] }),
  cardRow([
    ["El papel y la app tienen que coincidir", "La tarjeta y el cheque de cartón son el original; la app es el espejo."],
    ["Cobrar también es trabajo", "Cierren los resúmenes y revisen la mora: sin eso el banco se funde."],
  ]),
  h2("Las palabras del banco"),
  defTable([
    ["Caja", "La plata que el banco tiene ahora para prestar, pagar cheques y entregar por ventanilla."],
    ["Límite", "Lo máximo que un cliente puede gastar con su tarjeta antes de pagar el resumen."],
    ["Resumen", "La cuenta de lo que gastó con la tarjeta en el período, con su fecha de vencimiento."],
    ["Mora", "Un resumen que venció sin pagarse. El banco le cobra interés."],
    [
      "Librador",
      [["El que firma el cheque y del que sale la plata. El "], ["beneficiario", { bold: true }], [" es el que lo viene a cobrar."]],
    ],
    ["Comisión", [["Lo que se queda el banco de cada cheque que hace efectivo, en % del importe (ej. "], ["1%", mono], [")."]]],
    ["TNA", "Tasa nominal anual: cuánto paga el banco por año por la plata que le dejan a plazo fijo."],
  ]),
);

/* --------------------------------------------------------------------- */

const doc = new Document({
  creator: "ColePay",
  title: "El banco en 10 pantallas — Guía del mostrador",
  description: "Guía de uso del mostrador del banco para los alumnos de quinto",
  styles: { default: { document: { run: { font: FONT, size: 21, color: "111827" } } } },
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
                t("ColePay · Mostrador del banco (quinto año)", { size: 17, color: GREY }),
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
