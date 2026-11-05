/**
 * Dibuja el comprobante como imagen PNG, en el navegador y sin librerías, para
 * mandarlo por WhatsApp o mail como una foto y no como un texto suelto.
 * Siempre sale con colores de papel, aunque la app esté en el tema oscuro.
 */

export type ReceiptImageData = {
  title: string;
  verb: string;
  amount: string;
  date: string;
  parties: {
    label: string;
    name: string;
    you: boolean;
    lines: [string, string][];
  }[];
  rows: [string, string][];
  /** Número de comprobante, de 4 caracteres. */
  code: string;
};

const W = 720;
const PAD = 40;
const FONT = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

const INK = "#0f121a";
const MUTED = "rgba(15,18,26,0.55)";
const FAINT = "rgba(15,18,26,0.4)";
const LINE = "#e0e4ec";
const SOFT = "#f3f5f9";
const ACCENT = "#00a37a";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Parte un texto en renglones que entren en `maxW`, cortando palabras largas. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = "";
  const push = () => {
    if (line) out.push(line);
    line = "";
  };
  for (const word of text.split(/\s+/)) {
    let w = word;
    while (ctx.measureText(w).width > maxW) {
      // Palabra más ancha que el renglón (un CVU, por ejemplo): se corta.
      let n = w.length;
      while (n > 1 && ctx.measureText(w.slice(0, n)).width > maxW) n--;
      push();
      out.push(w.slice(0, n));
      w = w.slice(n);
    }
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxW) {
      push();
      line = w;
    } else {
      line = next;
    }
  }
  push();
  return out.length ? out : [""];
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Dibuja en `ctx` y devuelve el alto total; sirve también para medir. */
function paint(
  ctx: CanvasRenderingContext2D,
  d: ReceiptImageData,
  logo: HTMLImageElement | null,
): number {
  const inner = W - PAD * 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, 4000);
  ctx.textBaseline = "alphabetic";

  const text = (
    s: string,
    x: number,
    y: number,
    opts: { size: number; weight?: number; color: string; align?: CanvasTextAlign; mono?: boolean },
  ) => {
    ctx.font = `${opts.weight ?? 400} ${opts.size}px ${opts.mono ? MONO : FONT}`;
    ctx.fillStyle = opts.color;
    ctx.textAlign = opts.align ?? "left";
    ctx.fillText(s, x, y);
  };
  const hr = (y: number) => {
    ctx.fillStyle = LINE;
    ctx.fillRect(0, y, W, 2);
  };

  // Encabezado: marca a la izquierda, tipo de comprobante a la derecha.
  let y = 0;
  if (logo) {
    ctx.save();
    roundRect(ctx, PAD, 28, 56, 56, 14);
    ctx.clip();
    ctx.drawImage(logo, PAD, 28, 56, 56);
    ctx.restore();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    roundRect(ctx, PAD, 28, 56, 56, 14);
    ctx.stroke();
  }
  const nameX = PAD + (logo ? 70 : 0);
  text("Cole", nameX, 68, { size: 32, weight: 700, color: INK });
  const coleW = ctx.measureText("Cole").width;
  text("Pay", nameX + coleW, 68, { size: 32, weight: 700, color: ACCENT });

  ctx.font = `600 16px ${FONT}`;
  const titleLines = wrap(ctx, d.title.toUpperCase(), 250);
  titleLines.forEach((l, i) =>
    text(l, W - PAD, 50 + i * 22, { size: 16, weight: 600, color: MUTED, align: "right" }),
  );
  y = 112;
  hr(y);

  // Monto.
  y += 56;
  ctx.fillStyle = "rgba(0,163,122,0.15)";
  ctx.beginPath();
  ctx.arc(W / 2, y, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(W / 2 - 13, y + 1);
  ctx.lineTo(W / 2 - 3, y + 11);
  ctx.lineTo(W / 2 + 14, y - 9);
  ctx.stroke();

  y += 72;
  text(d.verb, W / 2, y, { size: 24, color: MUTED, align: "center" });
  y += 66;
  text(d.amount, W / 2, y, { size: 68, weight: 700, color: INK, align: "center" });
  y += 42;
  ctx.font = `400 20px ${FONT}`;
  for (const l of wrap(ctx, d.date, inner)) {
    text(l, W / 2, y, { size: 20, color: FAINT, align: "center" });
    y += 28;
  }
  y += 16;
  hr(y);
  y += 32;

  // Partes del movimiento.
  d.parties.forEach((p, i) => {
    const rows = p.lines.map(([k, v]) => {
      ctx.font = `400 19px ${FONT}`;
      const kw = ctx.measureText(k).width;
      ctx.font = `400 19px ${MONO}`;
      return { k, lines: wrap(ctx, v, inner - 56 - kw - 16) };
    });
    const boxH =
      24 + 22 + 38 + 12 + rows.reduce((a, r) => a + r.lines.length * 28, 0) + 20;
    ctx.fillStyle = SOFT;
    roundRect(ctx, PAD, y, inner, boxH, 20);
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    roundRect(ctx, PAD, y, inner, boxH, 20);
    ctx.stroke();

    let by = y + 24 + 14;
    text(p.label.toUpperCase(), PAD + 28, by, { size: 15, weight: 500, color: FAINT });
    by += 36;
    text(p.name, PAD + 28, by, { size: 27, weight: 700, color: INK });
    if (p.you) {
      const nw = ctx.measureText(p.name).width;
      text("(vos)", PAD + 28 + nw + 10, by, { size: 18, color: MUTED });
    }
    by += 18;
    for (const r of rows) {
      by += 28;
      text(r.k, PAD + 28, by, { size: 19, color: FAINT });
      ctx.font = `400 19px ${MONO}`;
      r.lines.forEach((l, li) =>
        text(l, W - PAD - 28, by + li * 28, { size: 19, color: MUTED, align: "right", mono: true }),
      );
      by += (r.lines.length - 1) * 28;
    }
    y += boxH;
    if (i < d.parties.length - 1) {
      text("↓", W / 2, y + 30, { size: 24, color: FAINT, align: "center" });
      y += 44;
    }
  });
  y += 32;
  hr(y);
  y += 20;

  // Resto de los datos.
  for (const [k, v] of d.rows) {
    ctx.font = `400 21px ${FONT}`;
    const kw = ctx.measureText(k).width;
    ctx.font = `600 21px ${FONT}`;
    const lines = wrap(ctx, v, inner - kw - 24);
    y += 34;
    text(k, PAD, y, { size: 21, color: MUTED });
    lines.forEach((l, i) =>
      text(l, W - PAD, y + i * 30, { size: 21, weight: 600, color: INK, align: "right" }),
    );
    y += (lines.length - 1) * 30 + 8;
  }
  y += 24;

  // Número de comprobante, grande para poder anotarlo.
  ctx.fillStyle = "rgba(0,163,122,0.1)";
  roundRect(ctx, PAD, y, inner, 150, 20);
  ctx.fill();
  text("N° DE COMPROBANTE", W / 2, y + 42, { size: 17, weight: 600, color: MUTED, align: "center" });
  text(d.code.split("").join(" "), W / 2, y + 112, {
    size: 64,
    weight: 700,
    color: INK,
    align: "center",
    mono: true,
  });
  y += 150 + 32;

  hr(y);
  ctx.fillStyle = SOFT;
  ctx.fillRect(0, y + 2, W, 58);
  text("ColePay · Moneda ficticia con fines educativos", W / 2, y + 38, {
    size: 16,
    color: FAINT,
    align: "center",
  });
  return y + 60;
}

/** Arma la imagen del comprobante lista para compartir. */
export async function buildReceiptImage(d: ReceiptImageData): Promise<Blob> {
  const logo = await loadImage("/logo-mark.png").catch(() => null);
  const scale = 2; // el doble de resolución: se lee bien aun reenviada

  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) throw new Error("Canvas no disponible");
  const height = paint(probe, d, logo);

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.scale(scale, scale);
  paint(ctx, d, logo);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No se pudo generar la imagen"))),
      "image/png",
    ),
  );
}
