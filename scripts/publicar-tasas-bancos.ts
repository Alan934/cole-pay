/**
 * Publica la pizarra de plazo fijo de cada banco que todavía no tenga una.
 *
 * Se corre una sola vez, al pasar los plazos fijos del Banco Central a los
 * bancos de quinto. Toma los plazos que ya ofrecía el Banco Central (7, 14 y
 * 30 días) y les pone a cada banco una TNA derivada de su propia tasa de
 * préstamo anualizada, siempre por debajo, para que el spread arranque a favor
 * del banco. Después cada mostrador la mueve como quiera.
 *
 *     npx tsx scripts/publicar-tasas-bancos.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const globales = await prisma.depositTerm.findMany({
    where: { bankId: null },
    orderBy: { days: "asc" },
  });
  const plazos = globales.length > 0 ? globales.map((t) => t.days) : [7, 14, 30];
  const factores = [0.45, 0.55, 0.65];

  const bancos = await prisma.bank.findMany({
    include: { _count: { select: { depositTerms: true } } },
    orderBy: { name: "asc" },
  });

  for (const banco of bancos) {
    if (banco._count.depositTerms > 0) {
      console.log(`· ${banco.name}: ya tiene pizarra, no se toca.`);
      continue;
    }

    const anual = Number(banco.loanRatePct) * 12;
    const data = plazos.map((days, i) => ({
      bankId: banco.id,
      days,
      tnaPct: new Prisma.Decimal(
        Math.round(anual * (factores[i] ?? factores[factores.length - 1])),
      ),
    }));
    await prisma.depositTerm.createMany({ data });
    console.log(
      `✔ ${banco.name}: ` +
        data.map((t) => `${t.days}d ${t.tnaPct}% TNA`).join(" · "),
    );
  }

  const activos = await prisma.fixedDeposit.count({
    where: { bankId: null, status: "ACTIVE" },
  });
  if (activos > 0) {
    console.log(
      `\nQuedan ${activos} plazo(s) fijo(s) activos del Banco Central. ` +
        `Se siguen pudiendo retirar como antes; los nuevos van a un banco.`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
