"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdminEmpresaActivo } from "@/lib/auth/session";
import { opcional } from "@/lib/validacion/comun";
import { auditar } from "@/lib/seguridad";
import type { TipoCriterioInsignia } from "@/lib/supabase/database.types";

export type InsigniaState = {
  status: "idle" | "error" | "guardado";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

/**
 * Los mismos cuatro tipos que acepta el `check` de la base (migración 0031).
 * Se declaran aquí para que el formulario no ofrezca una opción que la base
 * rechazaría al guardar.
 */
export const TIPOS_CRITERIO: { valor: TipoCriterioInsignia; etiqueta: string; unidad: string; ayuda: string }[] = [
  {
    valor: "carreras_completadas",
    etiqueta: "Carreras completadas contigo",
    unidad: "carreras",
    ayuda: "Cuenta las carreras tuyas ya finalizadas en las que participó.",
  },
  {
    valor: "distancia_acumulada",
    etiqueta: "Kilómetros acumulados contigo",
    unidad: "km",
    ayuda: "Suma la distancia de las categorías que corrió en tus carreras.",
  },
  {
    valor: "distancia_en_una_carrera",
    etiqueta: "Distancia en una sola carrera",
    unidad: "km",
    ayuda: "Para premiar la hazaña: completar una 21K o una 42K tuya.",
  },
  {
    valor: "anos_distintos",
    etiqueta: "Años distintos corriendo contigo",
    unidad: "años",
    ayuda: "Fidelidad en el tiempo: tres ediciones seguidas, por ejemplo.",
  },
];

const insigniaSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, "El código debe tener al menos 3 caracteres.")
    .max(40)
    .regex(/^[A-Z0-9-]+$/, "Usa solo letras, números y guiones."),
  nombre: z.string().trim().min(3, "Ponle un nombre que el corredor entienda.").max(60),
  descripcion: opcional(z.string().trim().max(200)),
  iconoUrl: opcional(z.url("El icono debe ser una URL válida.")),
  tipo: z.enum(
    ["carreras_completadas", "distancia_acumulada", "distancia_en_una_carrera", "anos_distintos"],
    { message: "Selecciona qué hay que hacer para ganarla." }
  ),
  minimo: z.coerce.number().positive("El umbral debe ser mayor que cero."),
});

export async function guardarInsignia(
  insigniaId: string | null,
  _prevState: InsigniaState,
  formData: FormData
): Promise<InsigniaState> {
  const membresia = await requireAdminEmpresaActivo();

  const parsed = insigniaSchema.safeParse({
    codigo: formData.get("codigo"),
    nombre: formData.get("nombre"),
    descripcion: formData.get("descripcion"),
    iconoUrl: formData.get("iconoUrl"),
    tipo: formData.get("tipo"),
    minimo: formData.get("minimo"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const valores = {
    codigo: d.codigo,
    nombre: d.nombre,
    descripcion: d.descripcion || null,
    icono_url: d.iconoUrl || null,
    criterio: { tipo: d.tipo, minimo: d.minimo },
  };

  const { error } = insigniaId
    ? await supabase
        .from("insignias")
        .update(valores)
        .eq("id", insigniaId)
        .eq("empresa_id", membresia.empresaId)
    : await supabase.from("insignias").insert({ empresa_id: membresia.empresaId, ...valores });

  if (error) {
    const mensaje = error.message.includes("insignias_codigo_por_empresa")
      ? "Ya tienes una insignia con ese código."
      : "No se pudo guardar: " + error.message;
    return { status: "error", message: mensaje };
  }

  await auditar({
    accion: insigniaId ? "insignia.editar" : "insignia.crear",
    entidad: "insignias",
    entidadId: insigniaId,
    empresaId: membresia.empresaId,
    datosNuevos: { codigo: d.codigo, criterio: valores.criterio },
  });

  revalidatePath("/panel/insignias");
  return { status: "guardado" };
}

export async function alternarInsignia(insigniaId: string, activa: boolean) {
  const membresia = await requireAdminEmpresaActivo();

  const supabase = await createClient();
  const { error } = await supabase
    .from("insignias")
    .update({ activa })
    .eq("id", insigniaId)
    .eq("empresa_id", membresia.empresaId);
  if (error) throw new Error("No se pudo actualizar: " + error.message);

  revalidatePath("/panel/insignias");
}

export async function eliminarInsignia(insigniaId: string) {
  const membresia = await requireAdminEmpresaActivo();
  const supabase = await createClient();

  // Una insignia ya concedida está en el perfil de gente que se la ganó.
  // Borrarla se la quitaría del historial, así que se desactiva.
  const { count } = await supabase
    .from("usuario_insignias")
    .select("id", { count: "exact", head: true })
    .eq("insignia_id", insigniaId);

  if ((count ?? 0) > 0) {
    throw new Error(
      `Esta insignia ya la ganaron ${count} ${count === 1 ? "corredor" : "corredores"}. Desactívala en vez de borrarla.`
    );
  }

  const { error } = await supabase
    .from("insignias")
    .delete()
    .eq("id", insigniaId)
    .eq("empresa_id", membresia.empresaId);
  if (error) throw new Error("No se pudo eliminar: " + error.message);

  revalidatePath("/panel/insignias");
}

/**
 * Concede las insignias de una carrera ya finalizada, a mano.
 *
 * El reparto normal ocurre solo al marcar la carrera como finalizada. Esto
 * existe para el caso real de crear una insignia **después** de haber cerrado
 * carreras: sin un botón, el organizador tendría que reabrir y volver a cerrar
 * una carrera para que su insignia nueva llegara a quien ya se la había ganado.
 */
export async function repartirInsignias(eventoId: string) {
  await requireAdminEmpresaActivo();
  const supabase = await createClient();

  const { error } = await supabase.rpc("otorgar_insignias_de_evento", { p_evento_id: eventoId });
  if (error) throw new Error("No se pudieron conceder: " + error.message);

  revalidatePath("/panel/insignias");
}
