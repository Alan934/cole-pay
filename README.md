# 💚 ColePay

**Billetera electrónica ficticia con fines educativos.** Simulador de economía digital pensado para que estudiantes (~15 años) aprendan cómo funciona una billetera virtual tipo Mercado Pago y la gestión de finanzas personales. **El dinero es ficticio y no tiene valor real.**

Construido con **Next.js (App Router) + TypeScript + Prisma + PostgreSQL + Auth.js (NextAuth v5) + Tailwind CSS**.

---

## 🚀 Puesta en marcha

### 1. Requisitos
- Node.js 18+ (probado con v24)
- PostgreSQL 14+ corriendo localmente (probado con v18)

### 2. Configurar variables de entorno
Copiá `.env.example` a `.env` y ajustá `DATABASE_URL` a tu usuario/contraseña de Postgres:

```env
DATABASE_URL="postgresql://postgres:TU_PASSWORD@localhost:5432/colepay?schema=public"
AUTH_SECRET="un-secreto-largo-y-aleatorio"
AUTH_URL="http://localhost:3000"
```

> Generá un secreto seguro con: `npx auth secret`

### 3. Instalar dependencias y preparar la base
```bash
npm install
npx prisma migrate dev      # crea las tablas
npm run db:seed             # carga usuarios de prueba
```

### 4. Levantar la app
```bash
npm run dev
```
Abrí <http://localhost:3000>.

---

## 👤 Usuarios de prueba (creados por el seed)

| Rol    | Email                | Contraseña   |
|--------|----------------------|--------------|
| Admin  | `admin@colepay.edu`  | `admin1234`  |
| Alumno | `sofia@colepay.edu`  | `alumno1234` |
| Alumno | `mateo@colepay.edu`  | `alumno1234` |
| Alumno | `valen@colepay.edu`  | `alumno1234` |
| Alumno | `benja@colepay.edu`  | `alumno1234` |
| Alumno | `martina@colepay.edu`| `alumno1234` |

---

## 🧠 Roles y funcionalidades

### 👨‍🏫 Admin (Profesores — "Banco Central")
- **Panel de control**: saldo del banco, alumnos, dinero en circulación y por cobrar.
- **Emisión monetaria**: crear dinero ficticio de la nada hacia la billetera del admin.
- **Cargar saldo a un alumno**: transferir del banco a un alumno (simula efectivo físico).
- **Servicios y cobros**: crear un concepto (ej. "Alquiler Stand A") y asignarlo a un grupo entero o a alumnos específicos; ver quién pagó y quién debe.
- **Alumnos y grupos**: crear/editar alumnos, asignarlos a grupos (ej. `3A2026`).
- **Transacciones**: historial global e inmutable del sistema.

### 🎒 Student (Alumnos)
- **Dashboard**: saldo destacado, CVU y alias ficticios, accesos rápidos y resumen de gastos por categoría.
- **Transferencias**: enviar dinero a otro alumno por CVU o alias, con validación de saldo (atómica) y categoría de gasto.
- **Cuentas a pagar**: pagar facturas/servicios creados por el admin.
- **Metas de ahorro**: apartar dinero del saldo hacia objetivos con barra de progreso.
- **Plazo fijo**: invertir a 7/14/30 días y cobrar interés al vencer (lo paga el banco).
- **Cobrar (QR)**: mostrar un QR para recibir o crear un pedido de cobro con monto; se marca pagado solo al recibir el pago.
- **Actividad**: historial de ingresos y egresos (paginado).
- **Notificaciones**: avisos de dinero recibido, premios, multas y nuevas facturas.
- **Ajustes**: cambiar el alias (verificando unicidad).

### 🎨 Transversal
- **Tema claro/oscuro** con toggle persistente (sin parpadeo al recargar).
- **Paginación** en los historiales de actividad y de transacciones.

### 🧑‍🏫 Extras del Admin
- **Edición y anulación de cobros** pendientes (los pagados quedan inmutables).
- **Premios y multas**: bonificar o descontar saldo con un motivo (queda registrado y notificado).
- **Cobros recurrentes**: programar cobros periódicos por grupo y generarlos con un clic.
- **Reportes y ranking**: patrimonio por alumno, saldo por grupo y **exportación a CSV** (transacciones y deudores).

---

## 🏗️ Arquitectura

```
src/
├── app/
│   ├── (student)/        # Rutas del alumno: dashboard, transfer, bills, activity, settings, notifications
│   ├── admin/            # Rutas del admin: panel, students, groups, services, transactions
│   ├── actions/          # Server Actions (student.ts, admin.ts, auth.ts)
│   ├── login/            # Login
│   └── api/auth/         # Handler de Auth.js
├── components/           # UI (Button, Card, Input, Badge…) + componentes de student/admin
├── lib/                  # prisma, session, utils, validations (Zod), tx
├── auth.ts / auth.config.ts / middleware.ts
prisma/
├── schema.prisma        # Modelo de datos
└── seed.ts              # Datos de ejemplo
```

### Puntos clave de la lógica de negocio
- **Transacciones atómicas**: transferencias y pagos usan `prisma.$transaction()`; el saldo se relee dentro de la transacción y se valida antes de debitar (previene saldos negativos).
- **Registro inmutable**: cada movimiento genera una fila en `Transaction` (`TRANSFER`, `ISSUANCE`, `DEPOSIT`, `PAYMENT`).
- **Dinero con precisión**: `Decimal(14,2)` en la base + `Prisma.Decimal` en el código (nada de floats).
- **Validación**: todos los inputs pasan por esquemas Zod.
- **Autorización**: el middleware protege rutas por rol; las Server Actions revalidan la sesión.

---

## 🧪 Tests end-to-end

La app tiene una suite E2E con **Playwright** (65 tests) que cubre los flujos del
alumno, del admin y las combinaciones de ambos, incluyendo casos de error e
invariantes financieras.

> ⚠️ Los tests corren contra una base **local y aislada** (`colepay_test`),
> nunca contra la base configurada en `.env`. Son destructivos: resetean los
> datos antes de cada test.

```bash
npm run test:db:setup   # crea la base de test y le aplica las migraciones (1 sola vez)
npm run test:e2e        # corre los 65 tests
npm run test:e2e:ui     # modo interactivo, para depurar
npm run test:e2e:report # abre el último reporte HTML
```

El servidor de pruebas se levanta solo en el puerto **3100**, así que podés
tener `npm run dev` corriendo en el 3000 al mismo tiempo.

### Qué cubre

| Archivo | Cobertura |
|---|---|
| `e2e/01-auth.spec.ts` | Login por rol, credenciales inválidas, rutas protegidas, alumno que intenta entrar al panel admin, logout, persistencia del tema |
| `e2e/02-student.spec.ts` | Transferencias (alias y CVU), saldo insuficiente, autotransferencia, destinatario inexistente, alias duplicado/inválido, pago de cuentas, notificaciones, metas de ahorro, plazo fijo e interés, pedidos de cobro, paginación, resumen de gastos |
| `e2e/03-admin.spec.ts` | Emisión monetaria, carga de saldo, premios y multas (con sus límites), alta/edición de alumnos y grupos, cobros por grupo e individuales, edición/anulación, inmutabilidad de cobros pagados, recurrentes, filtros y buscadores, reportes, exportación CSV y su control de acceso |
| `e2e/04-mixed.spec.ts` | Ciclo completo emisión→carga→gasto→cobro→pago→reporte, QR pagado por otro alumno, doble pago bloqueado, cobro cobrado por el profe correcto, anulación vista por el alumno, y la **invariante de conservación del dinero** |

---

## 📜 Scripts útiles
| Comando               | Descripción                          |
|-----------------------|--------------------------------------|
| `npm run dev`         | Servidor de desarrollo               |
| `npm run build`       | Build de producción                  |
| `npm run db:seed`     | Cargar datos de prueba               |
| `npm run prisma:studio` | Explorar la base con Prisma Studio |

---

> ⚠️ Proyecto educativo. Dinero 100% ficticio, sin valor real.
