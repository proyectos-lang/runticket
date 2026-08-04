"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdminDeEvento } from "@/lib/auth/session";
import { auditar } from "@/lib/seguridad";

export type DeclaracionState = {
  status: "idle" | "error" | "guardado";
  message?: string;
};

const esquema = z.object({
  contenido: z
    .string()
    .trim()
    .min(100, "El texto es demasiado corto para ser una declaración de responsabilidad.")
    .max(20000),
  soloEsteEvento: z.string().optional(),
});

/**
 * Publica una versión nueva de la declaración de salud.
 *
 * **Nunca se edita una versión existente**: los inscritos anteriores firmaron
 * ese texto concreto y su PDF lo acredita. Cambiarlo dejaría constancia de que
 * aceptaron algo que en realidad nunca vieron. Se crea una versión nueva y las
 * inscripciones antiguas siguen apuntando a la suya.
 */
export async function publicarDeclaracion(
  eventoId: string,
  _prevState: DeclaracionState,
  formData: FormData
): Promise<DeclaracionState> {
  const { empresaId } = await requireAdminDeEvento(eventoId);

  const parsed = esquema.safeParse({
    contenido: formData.get("contenido"),
    soloEsteEvento: formData.get("soloEsteEvento") ?? undefined,
  });
  if (!parsed.success) {
    const primero = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { status: "error", message: primero ?? "Revisa el texto." };
  }

  const soloEsteEvento = parsed.data.soloEsteEvento === "on";
  const supabase = await createClient();

  // La versión es por ámbito: las del evento llevan su propia numeración,
  // independiente de la general de la empresa.
  const consulta = supabase
    .from("declaraciones_salud")
    .select("version")
    .eq("empresa_id", empresaId)
    .order("version", { ascending: false })
    .limit(1);

  const { data: ultima } = soloEsteEvento
    ? await consulta.eq("evento_id", eventoId)
    : await consulta.is("evento_id", null);

  const { error } = await supabase.from("declaraciones_salud").insert({
    empresa_id: empresaId,
    evento_id: soloEsteEvento ? eventoId : null,
    version: (ultima?.[0]?.version ?? 0) + 1,
    contenido: parsed.data.contenido,
  });
  if (error) return { status: "error", message: "No se pudo publicar: " + error.message };

  await auditar({
    accion: "declaracion.publicar",
    entidad: "declaraciones_salud",
    empresaId,
    datosNuevos: { evento_id: soloEsteEvento ? eventoId : null, longitud: parsed.data.contenido.length },
  });

  revalidatePath(`/panel/eventos/${eventoId}/declaracion`);
  return { status: "guardado" };
}
