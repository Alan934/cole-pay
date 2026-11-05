/**
 * Convierte un destino de redirección que viene de afuera (el `callbackUrl` del
 * login, el contenido de un QR) en una ruta interna segura: siempre empieza con
 * una sola "/" y nunca conserva el dominio, así que no sirve para mandar a
 * alguien a otro sitio (open redirect). Devuelve `null` si no es utilizable.
 */
export function safeInternalPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2000) {
    return null;
  }
  let url: URL;
  try {
    // La base sólo sirve para resolver rutas relativas; el dominio se descarta.
    url = new URL(raw, "http://colepay.local");
  } catch {
    return null;
  }
  const path = url.pathname + url.search;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  // Volver al login (o a una ruta de la API) no tiene sentido como destino.
  if (url.pathname === "/login" || url.pathname.startsWith("/api")) return null;
  return path;
}

/**
 * Lee un QR de cobro de ColePay (`<origen>/transfer?to=...&amount=...`) y
 * devuelve la ruta interna a la que hay que ir para pagarlo. Se ignora el
 * origen del QR a propósito: se paga siempre en la app donde ya hay sesión.
 */
export function paymentPathFromQr(text: string): string | null {
  const path = safeInternalPath(text.trim());
  if (!path) return null;
  const url = new URL(path, "http://colepay.local");
  if (url.pathname !== "/transfer") return null;
  if (!url.searchParams.get("to")) return null;
  return path;
}
