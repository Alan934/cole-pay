"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Trophy, CheckCircle2, ChevronRight } from "lucide-react";
import { answerQuiz } from "@/app/actions/interest";
import type { ActionResult } from "@/app/actions/student";
import { QUIZ_QUESTIONS } from "@/lib/quiz";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

/** Las respuestas se corrigen en el servidor: acá nunca viaja la correcta. */
export function Quiz({ solvedIds }: { solvedIds: string[] }) {
  const solved = new Set(solvedIds);
  const firstPending = QUIZ_QUESTIONS.findIndex((q) => !solved.has(q.id));
  const [index, setIndex] = useState(
    firstPending === -1 ? 0 : firstPending,
  );
  const question = QUIZ_QUESTIONS[index];
  const allDone = solved.size === QUIZ_QUESTIONS.length;

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-300" />
          <CardTitle className="text-ink/80">Desafío</CardTitle>
        </div>
        <Badge tone={allDone ? "success" : "neutral"}>
          {solved.size} / {QUIZ_QUESTIONS.length}
        </Badge>
      </div>
      <p className="mb-4 text-sm text-ink/50">
        {allDone
          ? "¡Las resolviste todas! Podés volver a intentarlas cuando quieras."
          : "Cinco preguntas para ver si te quedó claro. Podés reintentar sin límite."}
      </p>

      <QuestionCard
        key={question.id}
        question={question}
        alreadySolved={solved.has(question.id)}
      />

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-raised pt-3">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="text-xs text-ink/50 transition-colors hover:text-ink disabled:opacity-30"
        >
          Anterior
        </button>
        <span className="text-xs text-ink/40">
          Pregunta {index + 1} de {QUIZ_QUESTIONS.length}
        </span>
        <button
          type="button"
          onClick={() =>
            setIndex((i) => Math.min(QUIZ_QUESTIONS.length - 1, i + 1))
          }
          disabled={index === QUIZ_QUESTIONS.length - 1}
          className="inline-flex items-center gap-1 text-xs text-ink/50 transition-colors hover:text-ink disabled:opacity-30"
        >
          Siguiente <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </Card>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Corrigiendo..." : "Responder"}
    </Button>
  );
}

function QuestionCard({
  question,
  alreadySolved,
}: {
  question: (typeof QUIZ_QUESTIONS)[number];
  alreadySolved: boolean;
}) {
  const [state, action] = useActionState<ActionResult | null, FormData>(
    answerQuiz,
    null,
  );
  const [choice, setChoice] = useState("");

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="questionId" value={question.id} />

      <div className="flex items-start gap-2">
        {alreadySolved && (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        )}
        <p className="text-sm font-medium leading-relaxed text-ink/85">
          {question.prompt}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {question.options.map((opt) => (
          <label
            key={opt}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
              choice === opt
                ? "border-accent/60 bg-accent/5"
                : "border-raised2 hover:bg-raised/50"
            }`}
          >
            <input
              type="radio"
              name="answer"
              value={opt}
              checked={choice === opt}
              onChange={() => setChoice(opt)}
              className="h-4 w-4 shrink-0 accent-[var(--accent)]"
            />
            <span className="text-ink/80">{opt}</span>
          </label>
        ))}
      </div>

      {state && (
        <p
          className={`rounded-xl border px-3 py-2 text-sm leading-relaxed ${
            state.ok
              ? "border-accent/30 bg-accent/10 text-accent"
              : "border-amber-500/30 bg-amber-500/5 text-amber-300"
          }`}
        >
          {state.ok ? state.message : state.error}
        </p>
      )}

      <div>
        <Submit />
      </div>
    </form>
  );
}
