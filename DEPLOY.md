# 🚀 Despliegue en Vercel

## 1. Variables de entorno (¡el paso más importante!)

El archivo `.env` **no se sube al repo** (está en `.gitignore`), así que tenés que
cargar estas variables **a mano en Vercel**:

**Vercel → tu proyecto → Settings → Environment Variables**

| Variable | Valor | Entornos |
|---|---|---|
| `DATABASE_URL` | La cadena de conexión de tu base **Neon** (la misma de tu `.env`) | Production, Preview, Development |
| `AUTH_SECRET` | Un secreto largo y aleatorio. Generalo con `npx auth secret` o `openssl rand -base64 32` | Production, Preview, Development |
| `CRON_SECRET` | Otro secreto largo y aleatorio. Protege el cron diario de rendimientos | Production |

> ⚠️ **NO** cargues `AUTH_URL`. En Vercel, Auth.js detecta la URL solo. Si ponés
> `AUTH_URL=http://localhost:3000` (como en tu `.env` local), el login se rompe en
> producción.

Después de agregar/cambiar variables hay que **redeployar** (Deployments → ⋯ →
Redeploy) para que tomen efecto.

## 2. Base de datos

- Usá tu base de **Neon** (ya está en la nube, ideal para Vercel).
- Antes del primer deploy, asegurate de que el schema esté aplicado:
  ```bash
  # localmente, apuntando a Neon (o desde el dashboard de Neon)
  npx prisma migrate deploy
  ```
- El `build` de Vercel corre `prisma generate` automáticamente (está en el script
  `build` y en `postinstall`), pero **no** corre migraciones ni el seed. Esos los
  hacés vos una vez.

## 3. Neon: connection pooling

Vercel es serverless y abre muchas conexiones. Usá la cadena de conexión
**"Pooled"** de Neon (la que tiene `-pooler` en el host), que es justo la que ya
tenés en tu `.env`. ✅

## 4. Rendimientos: el cron diario

Los intereses **no** se acreditan solos en tu compu: los acredita Vercel una vez
por día. La configuración ya está en `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/accrual", "schedule": "0 3 * * *" }] }
```

- Corre a las **03:00 UTC** = medianoche en Argentina.
- Vercel llama al endpoint con `Authorization: Bearer $CRON_SECRET`. Si no
  cargaste `CRON_SECRET` en Vercel, el endpoint **no acredita nada** (falla
  cerrado a propósito, para que nadie de afuera pueda dispararlo).
- En el plan Hobby de Vercel los crons corren **una vez por día** y el horario
  puede correrse un rato. No pasa nada: la liquidación calcula los días reales
  transcurridos y no paga dos veces el mismo período.
- Para verlo funcionar: Vercel → tu proyecto → **Cron Jobs**.
- Si un día no corrió, entrá a **/admin/rendimientos** y usá "Liquidar ahora".

> 💡 Mientras trabajás en `localhost` el cron no existe. Para probar en clase,
> usá el botón "Liquidar ahora" del panel de admin.

## 5. Checklist rápido

- [ ] `DATABASE_URL` cargada en Vercel (las 3 environments)
- [ ] `AUTH_SECRET` cargada en Vercel
- [ ] `CRON_SECRET` cargada en Vercel (Production)
- [ ] `AUTH_URL` **NO** está seteada (o apunta a tu dominio real, no a localhost)
- [ ] Migraciones aplicadas en Neon (`prisma migrate deploy`)
- [ ] Datos iniciales cargados si querés (`npm run db:seed` apuntando a Neon)
- [ ] Redeploy después de configurar las variables

## 6. Si el build falla

- Mirá el log completo en Vercel (Deployments → el deploy fallido → "Building").
  Los `warn`/`npm warn` **no** rompen el build; buscá una línea con `Error:` o
  `Failed to compile`.
- Verificá que estés en Next **15.5.20+** (parche de seguridad CVE-2025-66478).
- Si ves un error de Prisma tipo *"Query Engine for runtime rhel-openssl..."*, ya
  está resuelto con `binaryTargets` en `prisma/schema.prisma`.
