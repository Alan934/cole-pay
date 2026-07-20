import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-12 w-full rounded-xl border border-raised2 bg-panel/80 px-4 text-ink placeholder:text-ink/30 transition-colors focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/25",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Label = forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("mb-1.5 block text-sm font-medium text-ink/70", className)}
    {...props}
  />
));
Label.displayName = "Label";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-xl border border-raised2 bg-panel/80 px-4 py-3 text-ink placeholder:text-ink/30 transition-colors focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/25",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-12 w-full rounded-xl border border-raised2 bg-panel/80 px-4 text-ink transition-colors focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/25",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
