"use client";

import Fuse, { type IFuseOptions } from "fuse.js";
import { useMemo } from "react";

/**
 * Normaliza texto para comparar: saca tildes y pasa a minúsculas.
 * Así "José" matchea con "jose" y "3ro Básico" con "3ro basico".
 */
export function deburr(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Lee la propiedad indicada por Fuse y la normaliza antes de indexarla. */
function getFn(obj: unknown, path: string | string[]): string {
  const keys = Array.isArray(path) ? path : path.split(".");
  const value = keys.reduce<unknown>(
    (acc, key) =>
      acc && typeof acc === "object"
        ? (acc as Record<string, unknown>)[key]
        : undefined,
    obj,
  );
  return value == null ? "" : deburr(String(value));
}

/**
 * Opciones base: tolerante a typos ("peres" → "Pérez") pero sin devolver
 * cualquier cosa. Con 0.4 (el default de fuse) aparecía demasiado ruido.
 */
export const FUZZY_OPTIONS: IFuseOptions<unknown> = {
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 1,
  getFn,
};

/**
 * Filtra una lista por búsqueda difusa (fuse.js).
 * `keys` debe ser una constante estable (definila fuera del componente).
 * Con query vacía devuelve la lista original, sin reordenar.
 */
export function useFuzzyList<T>(items: T[], keys: string[], query: string): T[] {
  const keyId = keys.join("|");

  const fuse = useMemo(
    () => new Fuse(items, { ...FUZZY_OPTIONS, keys } as IFuseOptions<T>),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, keyId],
  );

  return useMemo(() => {
    const q = deburr(query.trim());
    if (!q) return items;
    // Con números en la búsqueda (códigos de grupo, DNI, montos) la tolerancia
    // a typos hace más mal que bien: "3B2026" traía también "3A2026", que está
    // a una sola letra. En ese caso buscamos la subcadena tal cual.
    if (/\d/.test(q)) {
      return items.filter((item) =>
        keys.some((key) => getFn(item, key).includes(q)),
      );
    }
    return fuse.search(q).map((r) => r.item);
  }, [fuse, items, keys, query]);
}
