/**
 * Colores de los gráficos de rendimientos.
 *
 * Tres series categóricas, una por nivel de liquidez. Están validadas para que
 * se distingan entre sí en tema claro y oscuro, y también para daltonismo
 * (deuteranopía, protanopía y tritanopía). No cambiarlas a ojo: cualquier
 * reemplazo hay que volver a validarlo.
 */
export const TIER_COLORS = {
  balance: "#2563EB", // saldo disponible
  goal: "#15A34A", // metas de ahorro
  deposit: "#9333EA", // plazo fijo
} as const;

export type TierKey = keyof typeof TIER_COLORS;
