/**
 * Guía del panel de bancos para la profe de quinto.
 *
 * Mismo formato que la guía del mostrador: capturas anotadas y el texto justo
 * para leerlas. Las capturas salen de `e2e/zz-quinto-shots.spec.ts` y las
 * marcas rojas las dibuja `scripts/annotate-shots.mjs`:
 *
 *   SHOTS_DIR=quintoshots npx playwright test e2e/zz-quinto-shots.spec.ts
 *   node scripts/annotate-shots.mjs quintoshots
 *   node scripts/build-quinto-profe-docx.mjs quintoshots/anotadas docs/ColePay-Quinto-Profe.docx
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
const OUT = process.argv[3] ?? "docs/ColePay-Quinto-Profe.docx";

const GREEN = "0A7C5A";
const GREEN_BADGE = "0FA36B";
const GREEN_TINT = "E9F7F1";

const k = createKit({
  shotsDir: SHOTS,
  accent: GREEN_BADGE,
  tint: GREEN_TINT,
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
    children: [t("El panel de quinto en 10 pantallas", { bold: true, size: 52 })],
  }),
  p("Todo lo que administrás vos: los bancos, sus equipos y el crédito del sistema. Lo importante está marcado en rojo.", {
    run: { size: 23, color: "374151" },
  }),
  new Paragraph({ spacing: { after: 80 }, children: [t("")] }),
  cardRow([
    ["Vos armás los bancos", "Los creás, les ponés la política de crédito y les cargás la caja."],
    ["Quinto atiende", "Cada banco lo operan sus empleados desde su propio mostrador."],
    ["Podés destrabar", "Si un banco no contesta, resolvés vos la solicitud."],
  ]),
);

/* --- 1. Entrar --- */
children.push(
  sectionTitle(1, "Entrar", "La dirección de ColePay"),
  p("Tu usuario entra directo a Bancos: no ves —ni tocás— servicios, facturas ni rendimientos."),
  ...shot("p1-entrar", ["Tu email de profe de quinto", "Tu contraseña", "Entrás directo a Bancos"], {
    imgW: 280,
    imgH: 220,
  }),
);

/* --- 2. Tu panel --- */
children.push(
  sectionTitle(2, "Tu panel", "La barra de arriba"),
  p("Tres secciones, nada más."),
  ...shot("p2-menu", [
    "Alumnos: las cuentas de tercero",
    "Bancos: crear, capitalizar, equipos",
    "Tarjetas: todo el crédito del sistema",
    "Salir",
  ]),
  callout([
    ["La caja del Banco Central es de la profe de tercero. ", { bold: true, color: GREEN }],
    ["Vos movés plata hacia los bancos de quinto (capitalizar), no hacia los alumnos."],
  ]),
);

/* --- 3. La lista de bancos --- */
children.push(
  sectionTitle(3, "La lista de bancos", "Bancos"),
  p("Una tarjeta por banco. De un vistazo: si tiene plata, cuánto prestó y qué tiene sin contestar."),
  ...shot("p3-bancos", [
    "Tocá el banco para entrar",
    "Cuántos lo atienden",
    "Abierto o cerrado",
    "Caja, prestado e interés",
  ], { wide: true }),
  callout([
    ["Si hay alumnos de quinto sin banco, arriba aparece un aviso. ", { bold: true, color: GREEN }],
    ["Sin banco asignado no pueden atender: entran y ven el mostrador vacío."],
  ]),
);

/* --- 4. Crear un banco --- */
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  sectionTitle(4, "Crear un banco", "Bancos · Crear un banco"),
  p("Lo que cargás acá es la política con la que van a salir sus tarjetas y sus préstamos."),
  ...shot("p4-crear-banco", [
    "Nombre y color de sus tarjetas",
    "Límite con el que salen las tarjetas",
    "Interés si el cliente no paga todo",
    "El día que cierra el resumen (al lado, los días para pagarlo)",
    "Interés del préstamo (al lado, el tope por operación)",
    "Crear",
  ], { wide: true }),
  callout(
    [
      ["Nace con la caja en cero. ", { bold: true, color: RED }],
      ["Hasta que no lo capitalices, sus clientes no pueden comprar con tarjeta ni pedir préstamos."],
    ],
    "red",
  ),
);

/* --- 5. Las cuentas de quinto --- */
children.push(
  sectionTitle(5, "Las cuentas de quinto", "Bancos · Crear un usuario de quinto"),
  p("Los empleados del banco no tienen billetera propia: sólo el mostrador de su banco."),
  ...shot("p5-crear-usuario", [
    "Nombre y apellido del alumno",
    "Con este email entra",
    "Contraseña provisoria",
    "Empleado del banco o profe",
    "Crear la cuenta",
  ], { wide: true }),
  callout([
    ["Elegí el banco en el mismo formulario. ", { bold: true, color: GREEN }],
    ["Es la forma más rápida de dejar armado el equipo: seis empleados por banco es un buen número."],
  ]),
);

/* --- 6. Capitalizar --- */
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  sectionTitle(6, "Cargarle plata a un banco", "Bancos · un banco · Capitalizar"),
  p("Es emisión del Banco Central hacia la caja del banco. Con esa plata adelantan los consumos con tarjeta y desembolsan los préstamos."),
  ...shot("p6-capitalizar", [
    "Cuánta plata le das",
    "Por qué se la das",
    "Entra a su caja",
    "Si el banco no cierra, cerrás vos",
  ], { wide: true }),
  callout([
    ["Capitalizá parejo a los tres bancos. ", { bold: true, color: GREEN }],
    ["La competencia entre ellos es parte del juego: si uno arranca con el doble, no hay competencia."],
  ]),
);

/* --- 7. El equipo --- */
children.push(
  sectionTitle(7, "El equipo del banco", "Bancos · un banco · Equipo"),
  p("Quién atiende ese mostrador. Se puede mover gente de un banco a otro en cualquier momento."),
  ...shot("p7-equipo", [
    "Los que ya atienden",
    "Sacarlo del mostrador",
    "Tildá a los que faltan",
    "Sumarlos al banco",
  ], { wide: true }),
  callout([
    ["Primero aparecen los que no tienen banco, ", { bold: true, color: GREEN }],
    ["y debajo los que hoy atienden en otro. Mover a alguien de banco no le borra nada: el mostrador es del banco, no de la persona."],
  ]),
);

/* --- 8. La política de crédito --- */
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  sectionTitle(8, "Cambiar las condiciones", "Bancos · un banco · Datos y política"),
  p("Sirve para ajustar el juego sobre la marcha: subir el interés, bajar el tope, cerrar un banco."),
  ...shot("p8-politica", [
    "Lo que cambies vale para las próximas",
    "Interés del préstamo y tope",
    "Cerrar el banco lo deja sin operar",
    "Guardar",
  ], { wide: true }),
  callout([
    ["Las tarjetas ya emitidas conservan sus condiciones. ", { bold: true, color: GREEN }],
    ["Cada una guarda una copia de la política con la que salió: cambiar el interés hoy no cambia las de ayer."],
  ]),
);

/* --- 9. Supervisar el crédito --- */
children.push(
  sectionTitle(9, "Supervisar el crédito", "Tarjetas"),
  p("Todo el crédito del sistema en una pantalla, sin importar de qué banco sea."),
  ...shot("p9-credito", [
    "Solicitudes que ningún banco contestó",
    "Tarjetas en la calle",
    "Plata prestada con tarjeta",
    "Clientes que no pagaron",
  ], { wide: true }),
  p("Debajo están los pedidos pendientes de todos los bancos: si uno no responde, lo resolvés vos."),
  ...shot("p10-resolver", [
    "Quién pide y a qué banco",
    "Los datos del cliente",
    "Podés resolverla vos",
  ], { wide: true }),
  callout([
    ["Usalo para destrabar, no para reemplazarlos. ", { bold: true, color: GREEN }],
    ["Que un pedido quede sin contestar también es información: mostrales la pantalla de pendientes."],
  ]),
);

/* --- 10. Los alumnos --- */
children.push(
  new Paragraph({ children: [new PageBreak()] }),
  sectionTitle(10, "Los alumnos de tercero", "Alumnos"),
  p("Son los clientes de los bancos. Podés corregirles los datos y blanquearles la contraseña."),
  ...shot("p11-alumnos", [
    "Buscar por nombre, DNI o email",
    "Filtrar por curso",
    "El saldo de cada cliente",
    "Corregir datos o blanquear la clave",
  ], { wide: true }),
  callout([
    ["Las cuentas de profe las crea la profe de tercero. ", { bold: true, color: GREEN }],
    ["Vos creás alumnos y usuarios de quinto; también podés importar el curso desde Excel."],
  ]),
);

/* ------------------------------ Cierre ------------------------------- */

children.push(
  new Paragraph({ children: [new PageBreak()] }),
  h2("Antes de la primera clase"),
  defTable([
    ["1. Los bancos", "Creá un banco por equipo, con nombre y color distintos. La política puede quedar igual para todos al principio."],
    ["2. Las cuentas", "Creá un usuario por alumno de quinto y asignale su banco en el mismo formulario."],
    ["3. La caja", "Capitalizá los tres bancos con el mismo monto. Sin caja no funciona nada."],
    ["4. La prueba", "Entrá con el usuario de un alumno, mirá el mostrador y emití una tarjeta de prueba."],
  ], 2600),
  h2("Durante la cursada"),
  cardRow([
    ["Mirá los pendientes", "En Tarjetas ves de un golpe lo que ningún banco contestó."],
    ["Mirá la mora", "Los clientes que no pagaron son el mejor disparador de discusión."],
  ]),
  new Paragraph({ spacing: { after: 100 }, children: [t("")] }),
  cardRow([
    ["Cuidado con la caja en cero", "Un banco sin plata frena a todos sus clientes. Capitalizalo o que cobre lo que le deben."],
    ["Dejalos equivocarse", "Prestar de más y no poder pagar un retiro es la clase, no un error del sistema."],
  ]),
  h2("Cuatro palabras"),
  defTable([
    ["Capitalizar", "Ponerle plata a la caja de un banco. Es emisión: el dinero aparece en el sistema."],
    ["Caja", "Lo que el banco tiene disponible. De ahí salen los consumos con tarjeta, los préstamos y el efectivo."],
    ["Cierre / vencimiento", [["El día que se emite el resumen y los días que tiene el cliente para pagarlo (ej. cierra el "], ["25", mono], [", vence "], ["10", mono], [" días después)."]]],
    ["Mora", "Resumen vencido e impago. El banco le suma interés al siguiente resumen."],
  ]),
);

/* --------------------------------------------------------------------- */

const doc = new Document({
  creator: "ColePay",
  title: "El panel de quinto en 10 pantallas — Guía de la profe",
  description: "Guía del panel de bancos de ColePay para la profe de quinto",
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
                t("ColePay · Panel de bancos (profe de quinto)", { size: 17, color: GREY }),
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
