import { expect, type Locator } from "@playwright/test";

/**
 * Elige una opción en un `SearchSelect` (el combobox con búsqueda difusa que
 * reemplazó a los `<select>` nativos): abre el desplegable, escribe para
 * filtrar y clickea la opción.
 *
 * `label` es el texto principal de la opción, sin la pista de la derecha
 * (ej: "Sofia Test", no "Sofia Test 3A2026").
 */
export async function chooseOption(combobox: Locator, label: string) {
  await combobox.click();
  await combobox.fill(label);
  // El desplegable se renderiza al lado del input, dentro del mismo form.
  await combobox.page().getByRole("option", { name: label }).first().click();
  // Al elegir, el input muestra la etiqueta de la opción seleccionada.
  await expect(combobox).toHaveValue(label);
}
