import { test, expect } from "@playwright/test";
import { resetAndSeed, USERS, db, balanceOf, PASSWORD_STUDENT } from "./helpers/db";
import { loginAdmin, loginStudent, expectMainContains } from "./helpers/auth";

test.describe("Flujo del admin (Banco Central)", () => {
  test.beforeEach(async ({ page }) => {
    await resetAndSeed();
    await page.context().clearCookies();
  });

  /* ---------------------------- Emisión monetaria ------------------------- */

  test("emite dinero y queda registrado como ISSUANCE", async ({ page }) => {
    await loginAdmin(page);
    await page.getByLabel("Monto a crear").fill("50000");
    await page.getByRole("button", { name: "Emitir" }).click();
    await expectMainContains(page, "Emitiste");

    await expect
      .poll(async () => balanceOf(USERS.admin), { timeout: 15_000 })
      .toBe(1_050_000);
    const tx = await db.transaction.findFirst({ where: { type: "ISSUANCE" } });
    expect(Number(tx?.amount)).toBe(50000);
    expect(tx?.senderId).toBeNull(); // dinero "de la nada"
  });

  /* ------------------------- Cargar saldo a alumno ------------------------ */

  test("carga saldo a un alumno (sale del banco)", async ({ page }) => {
    await loginAdmin(page);
    const depForm = page.locator("form", {
      has: page.getByLabel("Concepto (opcional)"),
    });
    await depForm.getByLabel("Alumno").selectOption({ label: "Sofia Test (3A2026)" });
    await depForm.getByLabel("Monto").fill("2500");
    await depForm.getByLabel("Concepto (opcional)").fill("Efectivo entregado");
    await depForm.getByRole("button", { name: "Cargar saldo" }).click();

    await expectMainContains(page, "Cargaste");
    await expect.poll(async () => balanceOf(USERS.sofia), { timeout: 15_000 }).toBe(7500);
    expect(await balanceOf(USERS.admin)).toBe(997_500);
  });

  test("rechaza cargar más saldo del que tiene el banco", async ({ page }) => {
    await loginAdmin(page);
    const depForm = page.locator("form", {
      has: page.getByLabel("Concepto (opcional)"),
    });
    await depForm.getByLabel("Alumno").selectOption({ label: "Sofia Test (3A2026)" });
    await depForm.getByLabel("Monto").fill("9999999");
    await depForm.getByRole("button", { name: "Cargar saldo" }).click();

    await expectMainContains(page, /No tenés saldo suficiente/i);
    expect(await balanceOf(USERS.sofia)).toBe(5000);
    expect(await balanceOf(USERS.admin)).toBe(1_000_000);
  });

  /* ------------------------------ Premios y multas ------------------------ */

  test("premia a un alumno (el banco paga)", async ({ page }) => {
    await loginAdmin(page);
    const form = page.locator("form", { has: page.getByLabel("Motivo") });
    await form.getByRole("button", { name: /Premio/ }).click();
    await form.getByLabel("Alumno").selectOption({ label: "Valentina Test (3A2026)" });
    await form.getByLabel("Monto").fill("600");
    await form.getByLabel("Motivo").fill("Mejor emprendimiento");
    await form.getByRole("button", { name: "Premiar" }).click();

    await expectMainContains(page, "Premiaste a");
    await expect.poll(async () => balanceOf(USERS.valen), { timeout: 15_000 }).toBe(8600);
    expect(await balanceOf(USERS.admin)).toBe(999_400);
    const noti = await db.notification.findFirst({ where: { title: { contains: "premio" } } });
    expect(noti).not.toBeNull();
  });

  test("multa a un alumno (el dinero vuelve al banco)", async ({ page }) => {
    await loginAdmin(page);
    const form = page.locator("form", { has: page.getByLabel("Motivo") });
    await form.getByRole("button", { name: /Multa/ }).click();
    await form.getByLabel("Alumno").selectOption({ label: "Mateo Test (3A2026)" });
    await form.getByLabel("Monto").fill("400");
    await form.getByLabel("Motivo").fill("Llego tarde");
    await form.getByRole("button", { name: "Multar" }).click();

    await expectMainContains(page, "Multaste a");
    await expect.poll(async () => balanceOf(USERS.mateo), { timeout: 15_000 }).toBe(2600);
    expect(await balanceOf(USERS.admin)).toBe(1_000_400);
  });

  test("rechaza multar por encima del saldo del alumno", async ({ page }) => {
    await loginAdmin(page);
    const form = page.locator("form", { has: page.getByLabel("Motivo") });
    await form.getByRole("button", { name: /Multa/ }).click();
    await form.getByLabel("Alumno").selectOption({ label: "Benjamin Test (3B2026)" });
    await form.getByLabel("Monto").fill("99999");
    await form.getByLabel("Motivo").fill("Multa gigante");
    await form.getByRole("button", { name: "Multar" }).click();

    await expectMainContains(page, "no tiene saldo suficiente");
    expect(await balanceOf(USERS.benja)).toBe(1500);
  });

  /* -------------------------- Alumnos y grupos ---------------------------- */

  test("crea un alumno con billetera y puede iniciar sesión", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/admin/students");
    const form = page.locator("form", { has: page.getByLabel("Email (login)") });
    await form.getByLabel("Nombre").fill("Nuevo Alumno");
    await form.getByLabel("Email (login)").fill("nuevo@test.colepay");
    await form.getByLabel("Contraseña").fill(PASSWORD_STUDENT);
    await form.getByLabel("Grupo").selectOption({ label: "3A2026" });
    await form.getByRole("button", { name: "Crear alumno" }).click();
    await expectMainContains(page, "fue creado correctamente");

    const u = await db.user.findUnique({
      where: { email: "nuevo@test.colepay" },
      include: { wallet: true },
    });
    expect(u?.wallet).not.toBeNull();
    expect(u?.wallet?.cvu).toHaveLength(22);
    expect(Number(u?.wallet?.balance)).toBe(0);

    // El alumno nuevo puede entrar.
    await page.context().clearCookies();
    await loginStudent(page, "nuevo@test.colepay");
    await expectMainContains(page, "Saldo disponible");
  });

  test("rechaza crear un alumno con email duplicado", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/admin/students");
    const form = page.locator("form", { has: page.getByLabel("Email (login)") });
    await form.getByLabel("Nombre").fill("Repetida");
    await form.getByLabel("Email (login)").fill(USERS.sofia);
    await form.getByLabel("Contraseña").fill("otra1234");
    await form.getByRole("button", { name: "Crear alumno" }).click();
    await expectMainContains(page, "Ya existe un usuario con ese email");
  });

  test("edita un alumno y cambia su contraseña", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/admin/students");
    await page
      .locator("tr", { hasText: "Mateo Test" })
      .getByRole("button", { name: "Editar" })
      .click();
    const dialog = page.locator("form", {
      has: page.getByLabel("Nueva contraseña (opcional)"),
    });
    await dialog.getByLabel("Nombre").fill("Mateo Editado");
    await dialog.getByLabel("Nueva contraseña (opcional)").fill("clavenueva");
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();

    await expect
      .poll(async () => (await db.user.findUnique({ where: { email: USERS.mateo } }))?.name, {
        timeout: 15_000,
      })
      .toBe("Mateo Editado");

    // La contraseña nueva funciona.
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email").fill(USERS.mateo);
    await page.getByLabel("Contraseña").fill("clavenueva");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL("**/dashboard");
  });

  test("crea un grupo y rechaza nombres duplicados", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/admin/groups");
    await page.getByLabel("Nombre del grupo").fill("4A2026");
    await page.getByRole("button", { name: "Crear grupo" }).click();
    await expectMainContains(page, "Grupo 4A2026 creado");

    await page.getByLabel("Nombre del grupo").fill("3A2026");
    await page.getByRole("button", { name: "Crear grupo" }).click();
    await expectMainContains(page, "Ya existe un grupo con ese nombre");
  });

  test("el buscador de alumnos filtra la tabla", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/admin/students");
    await expect(page.locator("tbody tr")).toHaveCount(4);
    await page.getByPlaceholder("Buscar por nombre, email o grupo").fill("Sofia");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByPlaceholder("Buscar por nombre, email o grupo").fill("3B2026");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByPlaceholder("Buscar por nombre, email o grupo").fill("zzz");
    await expectMainContains(page, "Sin resultados");
  });

  test("el buscador de grupos filtra las tarjetas", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/admin/groups");
    await page.getByPlaceholder("Buscar grupo").fill("3B");
    await expectMainContains(page, "3B2026");
    await expect(page.locator("main")).not.toContainText("3A2026");
  });

  /* ------------------------------ Cobros / servicios ---------------------- */

  test("crea cobros para un grupo entero", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/admin/services");
    await page.getByLabel("Concepto").fill("Alquiler Stand A");
    await page.getByLabel("Monto").fill("300");
    await page.locator('select[name="groupId"]').selectOption({ label: "3A2026" });
    await page.getByRole("button", { name: "Crear cobro" }).click();

    await expectMainContains(page, "Se crearon 3 cobro(s)");
    expect(await db.invoice.count()).toBe(3);
    // Cada alumno del grupo recibe su notificación.
    expect(await db.notification.count({ where: { type: "NEW_INVOICE" } })).toBe(3);
  });

  test("crea cobros para alumnos específicos", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/admin/services");
    await page.getByLabel("Concepto").fill("Multa de kiosco");
    await page.getByLabel("Monto").fill("150");
    await page.getByRole("button", { name: "Alumnos específicos" }).click();
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: "Crear cobro" }).click();

    await expectMainContains(page, "Se crearon 1 cobro(s)");
    expect(await db.invoice.count()).toBe(1);
  });

  test("rechaza crear un cobro sin destinatarios", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/admin/services");
    await page.getByLabel("Concepto").fill("Sin destino");
    await page.getByLabel("Monto").fill("100");
    await page.getByRole("button", { name: "Alumnos específicos" }).click();
    await page.getByRole("button", { name: "Crear cobro" }).click();
    await expectMainContains(page, "Seleccioná un grupo o al menos un alumno");
    expect(await db.invoice.count()).toBe(0);
  });

  test("edita un cobro pendiente", async ({ page }) => {
    await createInvoiceFor(USERS.sofia, "Cobro original", 500);
    await loginAdmin(page);
    await page.goto("/admin/services");
    await page.getByRole("button", { name: "Editar" }).click();
    const dialog = page.locator("form", { has: page.getByLabel("Concepto") }).last();
    await dialog.getByLabel("Concepto").fill("Cobro corregido");
    await dialog.getByLabel("Monto").fill("750");
    await dialog.getByRole("button", { name: "Guardar" }).click();

    await expect
      .poll(async () => (await db.invoice.findFirstOrThrow()).description, { timeout: 15_000 })
      .toBe("Cobro corregido");
    expect(Number((await db.invoice.findFirstOrThrow()).amount)).toBe(750);
  });

  test("anula un cobro pendiente y avisa al alumno", async ({ page }) => {
    await createInvoiceFor(USERS.sofia, "Cobro a anular", 500);
    await loginAdmin(page);
    await page.goto("/admin/services");
    await page.getByRole("button", { name: "Anular" }).click();
    await page.getByRole("button", { name: "Sí, anular" }).click();

    await expect
      .poll(async () => (await db.invoice.findFirstOrThrow()).status, { timeout: 15_000 })
      .toBe("CANCELLED");
    const noti = await db.notification.findFirst({ where: { title: "Cobro anulado" } });
    expect(noti).not.toBeNull();
  });

  test("un cobro PAGADO es inmutable (sin acciones de editar/anular)", async ({ page }) => {
    const inv = await createInvoiceFor(USERS.sofia, "Ya pagado", 500);
    await db.invoice.update({
      where: { id: inv.id },
      data: { status: "PAID", paidAt: new Date() },
    });

    await loginAdmin(page);
    await page.goto("/admin/services");
    await expectMainContains(page, "Ya pagado");
    await expect(page.getByRole("button", { name: "Editar" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Anular" })).toHaveCount(0);
  });

  test("los filtros de estado de cobros funcionan", async ({ page }) => {
    await createInvoiceFor(USERS.sofia, "Pendiente uno", 100);
    const pagado = await createInvoiceFor(USERS.mateo, "Pagado uno", 200);
    await db.invoice.update({ where: { id: pagado.id }, data: { status: "PAID" } });

    await loginAdmin(page);
    await page.goto("/admin/services");
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await page.getByRole("button", { name: "Pendientes" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expectMainContains(page, "Pendiente uno");
    await page.getByRole("button", { name: "Pagadas" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expectMainContains(page, "Pagado uno");
    // Búsqueda por texto
    await page.getByRole("button", { name: "Todas" }).click();
    await page.getByPlaceholder("Buscar concepto o alumno").fill("Mateo");
    await expect(page.locator("tbody tr")).toHaveCount(1);
  });

  /* ---------------------------- Cobros recurrentes ------------------------ */

  test("programa un recurrente, lo genera y luego lo pausa", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/admin/recurring");
    await page.getByLabel("Concepto").fill("Alquiler semanal");
    await page.getByLabel("Monto").fill("250");
    await page.getByLabel("Cada (días)").fill("7");
    await page.getByLabel("Grupo").selectOption({ label: "3A2026" });
    await page.getByRole("button", { name: "Programar" }).click();
    await expectMainContains(page, "Cobro recurrente programado");

    // Vence de inmediato → se puede generar.
    await page.getByRole("button", { name: "Generar vencidos" }).click();
    await expectMainContains(page, "Se generaron 3 cobro(s)");
    expect(await db.invoice.count()).toBe(3);

    // Ya no está vencido: la próxima corrida se agenda a futuro.
    const rc = await db.recurringCharge.findFirstOrThrow();
    expect(rc.nextRunAt.getTime()).toBeGreaterThan(Date.now());

    // Pausar
    await page.getByRole("button", { name: "Pausar" }).click();
    await expect
      .poll(async () => (await db.recurringCharge.findFirstOrThrow()).active, {
        timeout: 15_000,
      })
      .toBe(false);
  });

  test("un recurrente pausado no genera cobros", async ({ page }) => {
    const g = await db.group.findFirstOrThrow({ where: { name: "3A2026" } });
    await db.recurringCharge.create({
      data: {
        description: "Pausado",
        amount: 100,
        intervalDays: 7,
        groupId: g.id,
        active: false,
        nextRunAt: new Date(Date.now() - 86_400_000),
      },
    });
    await loginAdmin(page);
    await page.goto("/admin/recurring");
    // El botón existe pero está deshabilitado: no hay vencidos activos.
    await expect(page.getByRole("button", { name: "Generar vencidos" })).toBeDisabled();
    expect(await db.invoice.count()).toBe(0);
  });

  /* ------------------------- Transacciones y reportes --------------------- */

  test("la búsqueda de transacciones filtra del lado del servidor", async ({ page }) => {
    const admin = await db.user.findFirstOrThrow({ where: { email: USERS.admin } });
    const sofia = await db.user.findFirstOrThrow({ where: { email: USERS.sofia } });
    await db.transaction.create({
      data: { type: "PRIZE", amount: 100, description: "Premio: algo", senderId: admin.id, receiverId: sofia.id },
    });
    await db.transaction.create({
      data: { type: "TRANSFER", amount: 50, description: "Cosa cualquiera", senderId: sofia.id, receiverId: admin.id },
    });

    await loginAdmin(page);
    await page.goto("/admin/transactions");
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await page.locator('input[name="q"]').fill("Premio");
    await page.locator('input[name="q"]').press("Enter");
    await page.waitForURL(/q=Premio/);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expectMainContains(page, "Premio: algo");
  });

  test("el ranking ordena por patrimonio (saldo + ahorro)", async ({ page }) => {
    const sofia = await db.user.findFirstOrThrow({ where: { email: USERS.sofia } });
    // Sofía: 5000 de saldo + 4000 ahorrados = 9000 → supera a Valentina (8000)
    await db.savingsGoal.create({
      data: { userId: sofia.id, name: "Meta", targetAmount: 5000, savedAmount: 4000 },
    });

    await loginAdmin(page);
    await page.goto("/admin/reports");
    const filas = page.locator("main").locator("p.font-medium");
    await expect(filas.first()).toContainText("Sofia Test");
    await expectMainContains(page, "$ 9.000,00");
  });

  test("exporta CSV de transacciones y de deudores", async ({ page }) => {
    await createInvoiceFor(USERS.sofia, "Deuda export", 300);
    await loginAdmin(page);

    const txRes = await page.request.get("/api/export/transactions");
    expect(txRes.status()).toBe(200);
    expect(txRes.headers()["content-type"]).toContain("text/csv");
    expect(await txRes.text()).toContain("Fecha,Tipo,De,Para,Categoria,Descripcion,Monto");

    const debtRes = await page.request.get("/api/export/debtors");
    expect(debtRes.status()).toBe(200);
    const debtCsv = await debtRes.text();
    expect(debtCsv).toContain("Alumno,Email,Grupo,Concepto,Monto,Vencimiento");
    expect(debtCsv).toContain("Deuda export");
  });

  test("un alumno NO puede descargar los CSV del admin", async ({ page }) => {
    await loginStudent(page, USERS.sofia);
    const res = await page.request.get("/api/export/transactions");
    expect(res.status()).toBe(403);
    const res2 = await page.request.get("/api/export/debtors");
    expect(res2.status()).toBe(403);
  });
});

/** Crea una factura pendiente para el alumno indicado. */
async function createInvoiceFor(email: string, description: string, amount: number) {
  const admin = await db.user.findFirstOrThrow({ where: { email: USERS.admin } });
  const student = await db.user.findFirstOrThrow({ where: { email } });
  return db.invoice.create({
    data: { description, amount, studentId: student.id, createdById: admin.id },
  });
}
