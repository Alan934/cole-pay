import { expect, type Locator, type Page } from "@playwright/test";

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

/**
 * Manda una transferencia desde el formulario ya completo: primero
 * "Continuar" (que busca al destinatario) y después "Confirmar" en el cartel
 * que muestra a quién le llega la plata.
 */
export async function submitTransfer(page: Page) {
  await page.getByRole("button", { name: "Continuar" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.getByRole("button", { name: "Confirmar" }).click();
}

/**
 * Igual que `submitTransfer` pero para los casos que no llegan al cartel:
 * el error (destinatario inexistente, saldo insuficiente) aparece en el
 * formulario apenas se aprieta "Continuar".
 */
export async function submitTransferExpectingError(page: Page) {
  await page.getByRole("button", { name: "Continuar" }).click();
}
