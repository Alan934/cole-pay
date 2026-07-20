import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-14 w-14" : "h-10 w-10";
  const text =
    size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-xl";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "grid place-items-center rounded-2xl bg-accent text-onaccent shadow-glow font-black",
          dims,
        )}
      >
        <span className={size === "lg" ? "text-2xl" : "text-base"}>C</span>
      </div>
      <span className={cn("font-bold tracking-tight", text)}>
        Cole<span className="text-accent">Pay</span>
      </span>
    </div>
  );
}
