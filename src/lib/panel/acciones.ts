"use server";

import { cookies } from "next/headers";
import { COOKIE_EVENTO, EVENTO_TODAS } from "@/lib/auth/session";

/**
 * Recuerda sobre qué carrera se está trabajando.
 *
 * Solo memoriza. **No autoriza nada y no debe usarse para decidir qué se puede
 * ver**: quien lea esta cookie tiene que validar el identificador contra las
 * carreras reales de la empresa activa, que es lo que hace `contextoModulo`.
 * Por eso aquí no se comprueba la propiedad de la carrera: guardar un id ajeno
 * no abre ninguna puerta, y comprobarlo daría la falsa impresión de que sí.
 *
 * `null` significa «todas las carreras», que es una elección tan legítima como
 * cualquier otra y también se recuerda.
 */
export async function recordarCarreraActiva(eventoId: string | null) {
  (await cookies()).set(COOKIE_EVENTO, eventoId ?? EVENTO_TODAS, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
