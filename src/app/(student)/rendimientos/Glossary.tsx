"use client";

import { BookOpen, ChevronDown } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";

const ENTRIES = [
  {
    term: "TNA — Tasa Nominal Anual",
    body: (
      <>
        Es cuánto ganarías en <strong>un año entero</strong> con esa tasa. Si el
        plazo es más corto, se reparte proporcionalmente: por eso siempre
        aparece <code className="text-ink/80">días ÷ 365</code> en la cuenta.
        Una TNA del 73% sobre $10.000 son $7.300 en un año… pero sólo $600 en 30
        días.
      </>
    ),
  },
  {
    term: "TEA — Tasa Efectiva Anual",
    body: (
      <>
        Es lo que <strong>realmente</strong> ganás en un año cuando los intereses
        se te acreditan seguido y quedan en la cuenta generando más interés. Por
        eso la TEA siempre es mayor que la TNA. Cuando compares dos opciones,
        compará TEA con TEA.
      </>
    ),
  },
  {
    term: "Interés simple vs. interés compuesto",
    body: (
      <>
        <strong>Simple</strong>: el interés se calcula siempre sobre el capital
        original (así funciona un plazo fijo hasta que vence).{" "}
        <strong>Compuesto</strong>: el interés se suma al capital y en la vuelta
        siguiente también genera interés (así funciona tu saldo disponible, que
        cobra todos los días). El compuesto arranca despacio y después se
        dispara.
      </>
    ),
  },
  {
    term: "Capital",
    body: (
      <>
        La plata que ponés a trabajar. El interés siempre se calcula{" "}
        <em>sobre</em> el capital: si el capital es chico, ninguna tasa lo hace
        grande de un día para el otro.
      </>
    ),
  },
  {
    term: "Liquidez",
    body: (
      <>
        Qué tan rápido podés disponer de tu plata. El saldo de la cuenta es
        líquido (lo usás ya); un plazo fijo no lo es (queda inmovilizado). El
        banco te paga más tasa justamente a cambio de que resignes liquidez. Ese
        canje es la decisión financiera de fondo.
      </>
    ),
  },
  {
    term: "Inflación y tasa real",
    body: (
      <>
        Si los precios suben más rápido que tu dinero, tenés más pesos pero
        comprás menos cosas. La <strong>tasa real</strong> es tu rendimiento una
        vez descontada la inflación. Puede ser negativa: ahí, aunque el número de
        la cuenta crezca, en realidad estás perdiendo.
      </>
    ),
  },
  {
    term: "¿De dónde sale el interés?",
    body: (
      <>
        En ColePay lo emite el Banco Central (o sea, la profe): es dinero nuevo
        que entra al sistema. En el panel de admin se ve cuánto se emitió por
        intereses. Si se emite mucho más rápido de lo que crece la economía del
        curso, los precios tienden a subir. Sí: eso también es inflación.
      </>
    ),
  },
];

export function Glossary() {
  return (
    <Card>
      <div className="mb-1 flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-accent" />
        <CardTitle className="text-ink/80">Glosario</CardTitle>
      </div>
      <p className="mb-3 text-sm text-ink/50">
        Las palabras que vas a escuchar en cualquier banco, explicadas cortito.
      </p>
      <div className="flex flex-col divide-y divide-raised">
        {ENTRIES.map((e) => (
          <details key={e.term} className="group py-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-ink/85">
              {e.term}
              <ChevronDown className="h-4 w-4 shrink-0 text-ink/40 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">{e.body}</p>
          </details>
        ))}
      </div>
    </Card>
  );
}
