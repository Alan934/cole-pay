/**
 * Prepara la base de datos LOCAL usada por los tests E2E.
 *
 * Crea (si no existe) la base `colepay_test` en el PostgreSQL local y le
 * aplica las migraciones. NUNCA toca la base de producción configurada en
 * `.env` — los tests deben correr aislados.
 *
 * Uso:  npm run test:db:setup
 */
import { execSync } from "node:child_process";
import { Client } from "pg";

const HOST = process.env.TEST_PGHOST ?? "localhost";
const PORT = process.env.TEST_PGPORT ?? "5432";
const USER = process.env.TEST_PGUSER ?? "postgres";
const PASSWORD = process.env.TEST_PGPASSWORD ?? "postgres";
const DB_NAME = "colepay_test";

const TEST_DATABASE_URL = `postgresql://${USER}:${PASSWORD}@${HOST}:${PORT}/${DB_NAME}?schema=public`;

async function main() {
  // 1. Crear la base si no existe (conectando a `postgres`).
  const admin = new Client({
    host: HOST,
    port: Number(PORT),
    user: USER,
    password: PASSWORD,
    database: "postgres",
  });
  await admin.connect();
  const { rowCount } = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [DB_NAME],
  );
  if (rowCount === 0) {
    await admin.query(`CREATE DATABASE ${DB_NAME}`);
    console.log(`✅ Base "${DB_NAME}" creada.`);
  } else {
    console.log(`ℹ️  Base "${DB_NAME}" ya existía.`);
  }
  await admin.end();

  // 2. Aplicar migraciones sobre la base de test.
  console.log("▶️  Aplicando migraciones...");
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });

  console.log("\n✅ Base de test lista. Ahora podés correr: npm run test:e2e");
}

main().catch((e) => {
  console.error("❌ No se pudo preparar la base de test:", e.message);
  console.error(
    "\nVerificá que PostgreSQL esté corriendo y que el usuario/contraseña sean correctos.\n" +
      "Podés sobreescribirlos con TEST_PGUSER / TEST_PGPASSWORD / TEST_PGHOST / TEST_PGPORT.",
  );
  process.exit(1);
});
