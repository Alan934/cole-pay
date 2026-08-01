"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

/** Alto máximo del desplegable y margen mínimo contra el borde de la ventana. */
const MAX_LIST_HEIGHT = 288;
const VIEWPORT_MARGIN = 16;
/** Padding vertical del `ul` (`p-1` arriba + abajo). */
const LIST_PADDING = 8;

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
  const [maxHeight, setMaxHeight] = useState(MAX_LIST_HEIGHT);
  const [dropUp, setDropUp] = useState(false);

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

  /*
   * Cerrar por clic afuera, no por `blur`: al agarrar la barra de scroll de la
   * lista el input pierde el foco (relatedTarget nulo) y el desplegable se
   * cerraba justo cuando ibas a deslizarlo.
   */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  /*
   * Acomoda el desplegable al espacio real que queda en la ventana: si abajo
   * no entra, se abre hacia arriba, y el alto se recorta en filas enteras
   * para que nunca quede media opción asomando contra el borde.
   */
  useLayoutEffect(() => {
    if (!open) return;

    const measure = () => {
      const anchor = inputRef.current;
      const list = listRef.current;
      if (!anchor || !list) return;

      const rect = anchor.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
      const above = rect.top - VIEWPORT_MARGIN;
      const up = below < 200 && above > below;
      const space = Math.min(MAX_LIST_HEIGHT, Math.max(96, up ? above : below));

      // `maxHeight` incluye el borde (box-sizing: border-box); el padding va
      // dentro de clientHeight. Hay que descontar los dos para contar filas.
      const border = list.offsetHeight - list.clientHeight;
      const chrome = border + LIST_PADDING;
      const row = list.firstElementChild?.getBoundingClientRect().height ?? 0;
      const rows = row > 0 ? Math.floor((space - chrome) / row) : 0;
      const next =
        rows > 0 ? Math.ceil(rows * row + chrome) : Math.floor(space);

      setDropUp(up);
      setMaxHeight((prev) => (Math.abs(prev - next) > 1 ? next : prev));
    };

    measure();
    window.addEventListener("resize", measure);
    // `true`: también al scrollear cualquier contenedor que lo contenga.
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, results.length]);

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
        // Solo si el foco se fue a otro control (Tab). Sin `relatedTarget` el
        // clic fue en algo no focusable —p. ej. la barra de scroll— y de eso
        // se encarga el listener de clic afuera.
        const next = e.relatedTarget as Node | null;
        if (next && !e.currentTarget.contains(next)) close();
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
          style={{ maxHeight }}
          className={cn(
            "scroll-list absolute z-50 w-full rounded-xl border border-raised2 bg-panel p-1 shadow-xl shadow-black/20",
            dropUp ? "bottom-full mb-1" : "top-full mt-1",
          )}
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
