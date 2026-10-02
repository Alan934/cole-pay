import { prisma } from "@/lib/prisma";

/**
 * Adhesión de un alumno de tercero a un banco.
 *
 * El trámite se hace en persona en el mostrador y los alumnos de quinto cargan
 * la relación en el sistema. Un alumno puede estar adherido a varios bancos y sólo opera con
 * esos. El **principal** es el primero al que se adhirió.
 */

/** Adhesiones vigentes (sin baja). */
export const ACTIVE_MEMBERSHIP = { endedAt: null } as const;

export type StudentBank = {
  bankId: string;
  name: string;
  color: string;
  adheredAt: Date;
  /** Primer banco al que se adhirió: el que figura como principal. */
  isPrimary: boolean;
};

/**
 * Bancos a los que el alumno está adherido, el principal primero. El principal
 * es la adhesión vigente más antigua: si dan de baja el primer banco, el
 * siguiente pasa a serlo sin tener que tocar nada.
 */
export async function getStudentBanks(
  studentId: string,
  opts: { onlyActiveBanks?: boolean } = {},
): Promise<StudentBank[]> {
  const rows = await prisma.bankMembership.findMany({
    where: {
      studentId,
      ...ACTIVE_MEMBERSHIP,
      ...(opts.onlyActiveBanks ? { bank: { active: true } } : {}),
    },
    orderBy: { adheredAt: "asc" },
    select: {
      adheredAt: true,
      bank: { select: { id: true, name: true, color: true } },
    },
  });
  return rows.map((r, i) => ({
    bankId: r.bank.id,
    name: r.bank.name,
    color: r.bank.color,
    adheredAt: r.adheredAt,
    isPrimary: i === 0,
  }));
}

/** ¿El alumno es cliente de este banco? */
export async function isAdhered(
  studentId: string,
  bankId: string,
): Promise<boolean> {
  const row = await prisma.bankMembership.findFirst({
    where: { studentId, bankId, ...ACTIVE_MEMBERSHIP },
    select: { id: true },
  });
  return row !== null;
}

/** ¿Está adherido a algún banco? */
export async function hasAnyMembership(studentId: string): Promise<boolean> {
  const row = await prisma.bankMembership.findFirst({
    where: { studentId, ...ACTIVE_MEMBERSHIP },
    select: { id: true },
  });
  return row !== null;
}

/** Mensajes para cuando una operación se rechaza por falta de adhesión. */
export const notAdheredMessage = (bankName: string) =>
  `Primero tenés que adherirte a ${bankName}: pedile al mostrador del banco que te dé de alta.`;

export const noBankMessage =
  "Primero tenés que adherirte a un banco: pedile a un mostrador que te dé de alta.";
