import { defineConfig } from "@playwright/test";

/**
 * Los tests E2E corren contra una base LOCAL aislada (`colepay_test`),
 * nunca contra la base de producción. El servidor de dev se levanta en el
 * puerto 3100 para no interferir con `npm run dev` (3000).
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/colepay_test?schema=public";

const PORT = 3100;
export const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Serial: los tests comparten la base y la resetean entre casos.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    actionTimeout: 15_000,
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      AUTH_SECRET: "e2e-test-secret-0123456789abcdefghijklmnop",
      AUTH_URL: BASE_URL,
      AUTH_TRUST_HOST: "true",
    },
  },
});
