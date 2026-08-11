/**
 * Identificación de una persona en los comprobantes: CUIT si lo tiene
 * cargado, si no el DNI. Es lo que se muestra en el detalle de cada
 * movimiento, igual que en una factura o un comprobante de transferencia.
 */

export type TaxId = { label: "CUIT" | "DNI"; value: string };

/** Formatea 11 dígitos como 20-45123678-3. */
export function formatCuit(cuit: string): string {
  const d = cuit.replace(/\D/g, "");
  if (d.length !== 11) return cuit;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/** Formatea un DNI con puntos: 45.123.678 */
export function formatDni(dni: string): string {
  const d = dni.replace(/\D/g, "");
  if (d.length < 7) return dni;
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** CUIT si está cargado; si no, DNI; si no hay ninguno, `null`. */
export function taxIdOf(person: {
  cuit?: string | null;
  dni?: string | null;
}): TaxId | null {
  if (person.cuit) return { label: "CUIT", value: formatCuit(person.cuit) };
  if (person.dni) return { label: "DNI", value: formatDni(person.dni) };
  return null;
}

/** Versión en una línea: "CUIT 20-45123678-3". Vacío si no hay datos. */
export function taxIdText(person: {
  cuit?: string | null;
  dni?: string | null;
}): string {
  const id = taxIdOf(person);
  return id ? `${id.label} ${id.value}` : "";
}
