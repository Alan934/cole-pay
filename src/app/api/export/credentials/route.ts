import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildCsv } from "@/lib/csv";

/**
 * Lista de accesos de un curso, para repartir en clase.
 *
 * La contraseña inicial de un alumno importado es su DNI, así que se puede
 * reconstruir cuando haga falta. Pero el alumno puede haberla cambiado desde
 * Ajustes: en vez de dar por sentado que sigue siendo el DNI —y mandar a la
 * profe a repartir una contraseña que no anda— se verifica contra el hash y
 * se dice la verdad en cada fila.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return new Response("No autorizado", { status: 403 });
  }

  const groupId = new URL(request.url).searchParams.get("groupId");
  if (!groupId) return new Response("Falta el grupo", { status: 400 });

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return new Response("Grupo no encontrado", { status: 404 });

  const students = await prisma.user.findMany({
    where: { groupId, role: "STUDENT" },
    select: { name: true, email: true, dni: true, passwordHash: true },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    students.map(async (s) => {
      let password: string;
      if (!s.dni) {
        // Alumno creado a mano con una contraseña que no se puede reconstruir.
        password = "(sin DNI cargado)";
      } else if (await bcrypt.compare(s.dni, s.passwordHash)) {
        password = s.dni;
      } else {
        password = "(la cambió el alumno)";
      }
      return [s.name, s.email, password];
    }),
  );

  const csv = buildCsv(["Alumno", "Email", "Contraseña"], rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="colepay-accesos-${group.name}.csv"`,
      // Son contraseñas: que no queden en ningún caché intermedio.
      "Cache-Control": "no-store",
    },
  });
}
