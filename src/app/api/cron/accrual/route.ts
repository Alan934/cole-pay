import { NextRequest, NextResponse } from "next/server";
import { accrueInterest } from "@/lib/accrual";
import { applyInflation } from "@/lib/inflation";

/**
 * Liquidación diaria automática.
 *
 * La dispara Vercel Cron una vez por día (ver `vercel.json`), mandando
 * `Authorization: Bearer $CRON_SECRET`. Acredita los intereses del día y,
 * si la inflación está activada, ajusta los precios.
 *
 * Es seguro que se ejecute de más: tanto la liquidación como el ajuste de
 * precios reclaman el período antes de tocar dinero, así que un reintento
 * no paga ni cobra dos veces.
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

  const interest = await accrueInterest({ trigger: "CRON" });
  const inflation = await applyInflation({ trigger: "CRON" });

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    interest,
    inflation,
  });
}
