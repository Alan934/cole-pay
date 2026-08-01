import { NextRequest, NextResponse } from "next/server";
import { accrueInterest } from "@/lib/accrual";
import { applyInflation } from "@/lib/inflation";
import { runRecurring } from "@/lib/recurring";

/**
 * Corrida diaria automática.
 *
 * La dispara Vercel Cron una vez por día (ver `vercel.json`), mandando
 * `Authorization: Bearer $CRON_SECRET`. Acredita los intereses del día,
 * ajusta los precios si la inflación está activada, y emite los cobros
 * recurrentes vencidos.
 *
 * El orden importa: primero se ajustan los precios y después se emiten los
 * cobros, así el alquiler de hoy sale al precio de hoy.
 *
 * Es seguro que se ejecute de más: los tres pasos reclaman su período antes
 * de tocar dinero, así que un reintento no paga ni cobra dos veces.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // Sin secreto configurado no se ejecuta: mejor que no acredite nada a que
  // cualquiera pueda dispararlo desde internet.
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET no está configurado." },
      { status: 500 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "No autorizado." },
      { status: 401 },
    );
  }

  // Si algo explota, el 500 tiene que decir *qué* explotó: acá solo se llega
  // con el secreto correcto, así que el detalle no queda expuesto a internet.
  try {
    const interest = await accrueInterest({ trigger: "CRON" });
    const inflation = await applyInflation({ trigger: "CRON" });
    const recurring = await runRecurring({ trigger: "CRON" });

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      interest,
      inflation,
      recurring,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[cron/accrual] falló la corrida diaria:", e);
    return NextResponse.json({ ok: false, error: detail }, { status: 500 });
  }
}
