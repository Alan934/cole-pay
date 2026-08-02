/**
 * Minutos de inactividad antes de que caduque la sesión.
 *
 * La app se usa en PCs compartidas de la institución: si un alumno se va sin
 * cerrar sesión, el siguiente no tiene que encontrarse la cuenta abierta.
 * El middleware refirma el JWT en cada request, así que esto es un plazo de
 * *inactividad*, no un máximo absoluto: mientras se navegue, se renueva.
 *
 * Lo consumen `auth.config.ts` (servidor, corta de verdad) y el componente
 * `IdleLogout` (cliente, cierra la pantalla antes de que el token venza).
 */
export const SESSION_IDLE_MINUTES = 15;
