/**
 * Reinicio de temporada: deja a cada alumno con $300.000 de patrimonio total
 * (saldo disponible + plazos fijos + metas de ahorro) y borra el historial,
 * para que arranquen todos parejos y "de cero".
 *
 * Qué hace:
 *   1. Backup completo (JSON) de todo lo que va a tocar.
 *   2. Ajusta el saldo de cada alumno:  saldo = 300.000 − plazos fijos − metas.
 *      Los plazos fijos y las metas NO se tocan: se conservan tal cual están.
 *      Si un alumno ya tiene más de 300.000 inmovilizados, el saldo queda en 0
 *      (no se le rompe el plazo fijo ni se le vacía la meta).
 *   3. Borra el historial: transacciones, facturas, pedidos de cobro y
 *      notificaciones. El historial de intereses (Rendimientos) se conserva.
 *
 * La cuenta ficticia del TP (Tomás Ledesma) queda en $0, no en 300.000.
 *
 * Uso:
 *   npx tsx scripts/reset-alumnos-300k.ts            # simulación (no escribe)
 *   npx tsx scripts/reset-alumnos-300k.ts --apply    # ejecuta de verdad
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

const OBJETIVO = 300_000;
/** Cuenta ficticia del TP: no es un alumno real, arranca vacía. */
const EMAIL_TP = "tomas.ledesma@colepay.edu";

const APPLY = process.argv.includes("--apply");

const money = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Fila = {
  id: string;
  name: string;
  email: string;
  grupo: string | null;
  saldo: string;
  pf: string;
  metas: string;
  sin_wallet: boolean;
};

async function main() {
  console.log(
    APPLY
      ? "MODO REAL: se van a escribir los cambios.\n"
      : "SIMULACION (usa --apply para ejecutar de verdad).\n"
  );

  // ---------------------------------------------------------------- backup
  const dir = join(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = join(dir, `reset-300k-${stamp}.json`);

  const dump = async (t: string) => prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "${t}"`);
  const backup = {
    generadoEl: new Date().toISOString(),
    Wallet: await dump("Wallet"),
    Transaction: await dump("Transaction"),
    Invoice: await dump("Invoice"),
    PaymentRequest: await dump("PaymentRequest"),
    Notification: await dump("Notification"),
    SavingsGoal: await dump("SavingsGoal"),
    FixedDeposit: await dump("FixedDeposit"),
  };
  writeFileSync(
    file,
    JSON.stringify(backup, (_k, v) => (typeof v === "bigint" ? Number(v) : v), 1),
    "utf8"
  );
  console.log(`Backup: ${file}`);
  console.log(
    `  billeteras=${backup.Wallet.length} transacciones=${backup.Transaction.length} ` +
      `facturas=${backup.Invoice.length} pedidos=${backup.PaymentRequest.length} ` +
      `notificaciones=${backup.Notification.length}\n`
  );
  if (backup.Wallet.length === 0) throw new Error("El backup salio vacio: abortado por las dudas.");

  // ------------------------------------------------------------ diagnóstico
  const filas = await prisma.$queryRawUnsafe<Fila[]>(`
    SELECT u.id, u.name, u.email, g.name AS grupo,
           COALESCE(w.balance, 0)::text AS saldo,
           COALESCE((SELECT SUM(d.principal) FROM "FixedDeposit" d
                     WHERE d."userId" = u.id AND d.status = 'ACTIVE'), 0)::text AS pf,
           COALESCE((SELECT SUM(s."savedAmount") FROM "SavingsGoal" s
                     WHERE s."userId" = u.id AND s.status <> 'ARCHIVED'), 0)::text AS metas,
           (w.id IS NULL) AS sin_wallet
    FROM "User" u
    LEFT JOIN "Wallet" w ON w."userId" = u.id
    LEFT JOIN "Group" g ON g.id = u."groupId"
    WHERE u.role = 'STUDENT'
    ORDER BY g.name NULLS LAST, u.name
  `);

  const huerfanos = filas.filter((f) => f.sin_wallet);
  if (huerfanos.length) {
    console.log(
      `AVISO: sin billetera y no se pueden ajustar: ${huerfanos.map((h) => h.name).join(", ")}\n`
    );
  }

  console.log(
    `${"ALUMNO".padEnd(34)} ${"SALDO HOY".padStart(13)} ${"PLAZO FIJO".padStart(13)} ` +
      `${"METAS".padStart(13)} ${"TOTAL HOY".padStart(13)} ${"AJUSTE".padStart(14)} ${"SALDO NUEVO".padStart(13)}`
  );
  console.log("-".repeat(132));

  let emitir = 0;
  let quitar = 0;
  let excedidos = 0;

  for (const f of filas) {
    const saldo = Number(f.saldo);
    const pf = Number(f.pf);
    const metas = Number(f.metas);
    const total = saldo + pf + metas;
    const esTP = f.email === EMAIL_TP;
    const nuevo = esTP ? 0 : Math.max(0, OBJETIVO - pf - metas);
    const ajuste = nuevo - saldo;
    if (ajuste > 0) emitir += ajuste;
    else quitar += -ajuste;
    if (!esTP && pf + metas > OBJETIVO) excedidos++;

    const nota = esTP
      ? "  <- cuenta TP, va a $0"
      : pf + metas > OBJETIVO
        ? "  <- inmovilizado > 300k"
        : "";
    console.log(
      `${f.name.slice(0, 34).padEnd(34)} ${money(saldo).padStart(13)} ${money(pf).padStart(13)} ` +
        `${money(metas).padStart(13)} ${money(total).padStart(13)} ` +
        `${((ajuste >= 0 ? "+" : "") + money(ajuste)).padStart(14)} ${money(nuevo).padStart(13)}${nota}`
    );
  }

  console.log("-".repeat(132));
  console.log(
    `Alumnos: ${filas.length}   |   se acredita: +${money(emitir)}   |   se descuenta: -${money(quitar)}`
  );
  if (excedidos) {
    console.log(
      `AVISO: ${excedidos} alumno(s) tienen mas de $300.000 inmovilizados: quedan con saldo $0 y conservan el excedente.`
    );
  }

  const [conteos] = await prisma.$queryRawUnsafe<any[]>(`
    SELECT (SELECT COUNT(*) FROM "Transaction")::int AS tx,
           (SELECT COUNT(*) FROM "Invoice")::int AS inv,
           (SELECT COUNT(*) FROM "PaymentRequest")::int AS req,
           (SELECT COUNT(*) FROM "Notification")::int AS notif
  `);
  console.log(
    `\nSe borran: ${conteos.tx} transacciones, ${conteos.inv} facturas, ` +
      `${conteos.req} pedidos de cobro, ${conteos.notif} notificaciones.`
  );
  console.log(
    "Se conservan: plazos fijos, metas de ahorro y el historial de intereses (Rendimientos)."
  );

  if (!APPLY) {
    console.log("\nSimulacion terminada. No se escribio nada.");
    return;
  }

  // -------------------------------------------------------------- ejecución
  await prisma.$transaction(async (t) => {
    const ajustados = await t.$executeRawUnsafe(
      `
      UPDATE "Wallet" w
      SET balance = GREATEST(
            0::numeric,
            $1::numeric
              - COALESCE((SELECT SUM(d.principal) FROM "FixedDeposit" d
                          WHERE d."userId" = w."userId" AND d.status = 'ACTIVE'), 0)
              - COALESCE((SELECT SUM(s."savedAmount") FROM "SavingsGoal" s
                          WHERE s."userId" = w."userId" AND s.status <> 'ARCHIVED'), 0)
          ),
          "updatedAt" = NOW()
      FROM "User" u
      WHERE u.id = w."userId" AND u.role = 'STUDENT' AND u.email <> $2
      `,
      OBJETIVO,
      EMAIL_TP
    );

    const tp = await t.$executeRawUnsafe(
      `UPDATE "Wallet" w SET balance = 0, "updatedAt" = NOW()
       FROM "User" u WHERE u.id = w."userId" AND u.email = $1`,
      EMAIL_TP
    );

    // Orden: primero lo que referencia a Transaction, despues Transaction.
    const invBorradas = await t.$executeRawUnsafe(`DELETE FROM "Invoice"`);
    const reqBorrados = await t.$executeRawUnsafe(`DELETE FROM "PaymentRequest"`);
    const notifBorradas = await t.$executeRawUnsafe(`DELETE FROM "Notification"`);
    const txBorradas = await t.$executeRawUnsafe(`DELETE FROM "Transaction"`);

    console.log(
      `\nBilleteras ajustadas: ${ajustados}${tp ? " (+1 cuenta TP en $0)" : ""}` +
        `\nBorrados: ${txBorradas} transacciones, ${invBorradas} facturas, ` +
        `${reqBorrados} pedidos, ${notifBorradas} notificaciones`
    );
  });

  // ------------------------------------------------------------ verificación
  const check = await prisma.$queryRawUnsafe<any[]>(`
    SELECT u.name, u.email,
           (COALESCE(w.balance,0)
            + COALESCE((SELECT SUM(d.principal) FROM "FixedDeposit" d
                        WHERE d."userId"=u.id AND d.status='ACTIVE'),0)
            + COALESCE((SELECT SUM(s."savedAmount") FROM "SavingsGoal" s
                        WHERE s."userId"=u.id AND s.status<>'ARCHIVED'),0)
           )::text AS total
    FROM "User" u LEFT JOIN "Wallet" w ON w."userId"=u.id
    WHERE u.role='STUDENT'
  `);
  const reales = check.filter((c) => c.email !== EMAIL_TP);
  const fuera = reales.filter((c) => Math.abs(Number(c.total) - OBJETIVO) > 0.005);
  console.log(
    `\nVerificacion: ${reales.length - fuera.length} de ${reales.length} alumnos quedaron en $300.000 exactos.`
  );
  for (const c of fuera) {
    console.log(`  - ${c.name}: ${money(Number(c.total))} (tiene mas de 300k inmovilizado)`);
  }
  const tpRow = check.find((c) => c.email === EMAIL_TP);
  if (tpRow) console.log(`  - ${tpRow.name} (cuenta TP): ${money(Number(tpRow.total))}`);
}

main()
  .catch((e) => {
    console.error("\nError: no se aplico nada.", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
