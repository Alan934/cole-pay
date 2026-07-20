import { cn } from "@/lib/utils";

type Tone = "accent" | "violet" | "warning" | "danger" | "neutral" | "success";

const tones: Record<Tone, string> = {
  accent: "bg-accent/15 text-accent border-accent/30",
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  violet: "bg-violet/15 text-violet border-violet/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  danger: "bg-red-500/15 text-red-300 border-red-500/30",
  neutral: "bg-raised2/60 text-ink/70 border-raised3",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
