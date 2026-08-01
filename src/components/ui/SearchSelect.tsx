"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFuzzyList } from "@/lib/fuzzy";

export type SearchOption = {
  value: string;
  label: string;
  /** Texto secundario (ej: el grupo del alumno). También entra en la búsqueda. */
  hint?: string | null;
};

const SEARCH_KEYS = ["label", "hint"];

type Props = {
  /** Nombre del campo en el FormData del server action. */
  name: string;
  options: SearchOption[];
  id?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Texto del input mientras se busca. */
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  onChange?: (value: string) => void;
};

/**
 * Combobox con búsqueda difusa (fuse.js) que reemplaza a un `<select>`.
 * Envía el valor elegido como un input oculto, así funciona igual dentro de
 * un `<form action={serverAction}>` y se limpia con `form.reset()`.
 */
export function SearchSelect({
  name,
  options,
  id,
  defaultValue = "",
  required,
  disabled,
  placeholder = "Seleccioná una opción…",
  searchPlaceholder = "Escribí para buscar…",
  emptyMessage = "Sin resultados.",
  className,
  onChange,
}: Props) {
  const autoId = useId();
  const inputId = id ?? `ss-${autoId}`;
  const listId = `${inputId}-list`;

  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const results = useFuzzyList(options, SEARCH_KEYS, open ? query : "");

  // Volver al valor inicial cuando el formulario se resetea tras enviarse.
  useEffect(() => {
    const form = hiddenRef.current?.form;
    if (!form) return;
    const onReset = () => {
      setValue(defaultValue);
      setQuery("");
      setOpen(false);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultValue]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  // Mantener visible la opción resaltada al navegar con el teclado.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function choose(option: SearchOption) {
    setValue(option.value);
    onChange?.(option.value);
    close();
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (results.length === 0) return;
      setActiveIndex((i) => {
        const next = e.key === "ArrowDown" ? i + 1 : i - 1;
        return (next + results.length) % results.length;
      });
    } else if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      const option = results[activeIndex];
      if (option) choose(option);
    } else if (e.key === "Escape") {
      if (!open) return;
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close();
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative", className)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && results[activeIndex]
              ? `${listId}-${results[activeIndex].value}`
              : undefined
          }
          disabled={disabled}
          value={open ? query : selected?.label ?? ""}
          placeholder={open ? searchPlaceholder : placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(
            "h-12 w-full cursor-pointer rounded-xl border border-raised2 bg-panel/80 pl-10 pr-9 text-ink placeholder:text-ink/30 transition-colors focus:border-accent/70 focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50",
            open && "cursor-text",
          )}
        />
        {!open && selected?.hint && (
          <span className="pointer-events-none absolute right-9 top-1/2 max-w-[40%] -translate-y-1/2 truncate text-xs text-ink/40">
            {selected.hint}
          </span>
        )}
        <ChevronDown
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40 transition-transform",
            open && "rotate-180",
          )}
        />
      </div>

      {/*
        Input real del formulario. Queda invisible pero enfocable para que el
        navegador pueda mostrar el mensaje de "completá este campo".
        Ojo: no puede ser `readOnly` porque eso lo exceptúa de la validación
        nativa y `required` dejaría de bloquear el envío.
      */}
      <input
        ref={hiddenRef}
        type="text"
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={() => {}}
        className="pointer-events-none absolute bottom-0 left-1/2 h-px w-px -translate-x-1/2 opacity-0"
      />

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-raised2 bg-panel p-1 shadow-xl shadow-black/20"
        >
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-ink/40">{emptyMessage}</li>
          ) : (
            results.map((o, i) => {
              const isSelected = o.value === value;
              return (
                <li
                  key={o.value}
                  id={`${listId}-${o.value}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(o)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm",
                    i === activeIndex ? "bg-raised2 text-ink" : "text-ink/80",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.hint && (
                    <span className="shrink-0 text-xs text-ink/40">{o.hint}</span>
                  )}
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-accent" />}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
