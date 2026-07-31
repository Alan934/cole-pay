/**
 * Preguntas del desafío de rendimientos.
 *
 * Son fijas a propósito: la corrección pasa por el servidor, así que la
 * respuesta correcta nunca viaja al navegador antes de que el alumno conteste.
 * Los números están elegidos para que la cuenta se pueda hacer de cabeza o
 * con la calculadora de la app.
 */

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  /** Coincide con una de las opciones. */
  correct: string;
  hint: string;
  explanation: string;
};

/** Hash estable (FNV-1a) del id, para sembrar el mezclado. */
function seedFrom(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/**
 * Reordena las opciones para que la correcta no quede siempre primera.
 *
 * Los distractores se mezclan con Fisher-Yates sembrado por el id y después la
 * correcta se coloca en una posición que va rotando pregunta a pregunta, así no
 * se repite ni queda un patrón adivinable. Todo determinista a propósito: el
 * servidor y el cliente tienen que renderizar el mismo orden o React rompe la
 * hidratación. La corrección compara el texto de la respuesta, no la posición,
 * así que reordenar es inocuo.
 */
function shuffleOptions(q: QuizQuestion, index: number): QuizQuestion {
  const rest = q.options.filter((o) => o !== q.correct);
  let s = seedFrom(q.id);
  for (let i = rest.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const options = [...rest];
  options.splice((index * 3) % q.options.length, 0, q.correct);
  return { ...q, options };
}

const RAW_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1-que-es-tna",
    prompt: "¿Qué significa TNA?",
    options: [
      "Tasa Nominal Anual",
      "Total Neto Acumulado",
      "Tasa Negociada de Ahorro",
      "Tope Nacional de Ahorro",
    ],
    correct: "Tasa Nominal Anual",
    hint: "Las tres palabras arrancan con T, N y A, y una de ellas es 'anual'.",
    explanation:
      "TNA = Tasa Nominal Anual: cuánto ganarías en un año entero si los " +
      "intereses no se reinvirtieran.",
  },
  {
    id: "q2-calculo-30d",
    prompt:
      "Tenés $10.000 a una TNA del 73%. ¿Cuánto interés ganás en 30 días? " +
      "(Interés = capital × TNA/100 × días/365)",
    options: ["$600,00", "$730,00", "$2.190,00", "$7.300,00"],
    correct: "$600,00",
    hint: "10.000 × 0,73 = 7.300 por año. Ahora repartilo: × 30 ÷ 365.",
    explanation:
      "10.000 × 0,73 × (30 ÷ 365) = 600. La TNA se prorratea por los días reales.",
  },
  {
    id: "q3-tna-vs-tea",
    prompt: "¿Por qué la TEA suele ser mayor que la TNA?",
    options: [
      "Porque los intereses ya cobrados generan más intereses",
      "Porque el banco cobra una comisión",
      "Porque la TEA incluye la inflación",
      "Porque la TEA se mide en dólares",
    ],
    correct: "Porque los intereses ya cobrados generan más intereses",
    hint: "Pensá qué pasa cuando el interés de hoy queda en la cuenta.",
    explanation:
      "Eso es interés compuesto: al reinvertirse, el interés también genera " +
      "interés, y por eso la TEA supera a la TNA.",
  },
  {
    id: "q4-liquidez",
    prompt:
      "¿Por qué un plazo fijo paga más TNA que el saldo disponible de la cuenta?",
    options: [
      "Porque resignás poder usar la plata durante un tiempo",
      "Porque es un premio del banco a los que ahorran",
      "Porque el saldo disponible no genera nada",
      "Porque el plazo fijo no tiene riesgo",
    ],
    correct: "Porque resignás poder usar la plata durante un tiempo",
    hint: "Pensá qué perdés cuando inmovilizás el dinero.",
    explanation:
      "Es el canje entre liquidez y rendimiento: cuanto menos disponible " +
      "tenés la plata, más te pagan por prestarla.",
  },
  {
    id: "q5-tasa-real",
    prompt:
      "Tu plata rinde 60% anual y la inflación anual es del 80%. ¿Qué te pasa?",
    options: [
      "Tenés más pesos pero podés comprar menos cosas",
      "Ganás porque igual te dieron intereses",
      "Quedás exactamente igual",
      "Perdés pesos de tu cuenta",
    ],
    correct: "Tenés más pesos pero podés comprar menos cosas",
    hint: "Compará cuánto sube tu plata contra cuánto suben los precios.",
    explanation:
      "La tasa real es negativa: los precios suben más rápido que tu dinero, " +
      "así que perdés poder de compra aunque el número de la cuenta crezca.",
  },
];

/** Las preguntas tal como las ve el alumno, con las opciones ya mezcladas. */
export const QUIZ_QUESTIONS: QuizQuestion[] = RAW_QUESTIONS.map((q, i) =>
  shuffleOptions(q, i),
);

export function findQuestion(id: string) {
  return QUIZ_QUESTIONS.find((q) => q.id === id);
}
