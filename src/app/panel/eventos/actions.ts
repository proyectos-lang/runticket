"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminEmpresaActivo, requireAdminDeEvento } from "@/lib/auth/session";
import type { EstadoEvento } from "@/lib/supabase/database.types";
import { crearEventoSchema } from "@/lib/validacion/eventos";
import { fechaLocalAIso } from "@/lib/format";
import { generarSlug } from "@/lib/slug";
import { sanearHtml } from "@/lib/sanitizar";

export type CrearEventoState = {
  status: "idle" | "error";
  message?: string;
  errors?: Partial<
    Record<"nombre" | "slug" | "descripcion" | "fechaInicio" | "fechaLimiteInscripcion" | "direccion", string[]>
  >;
};

export async function crearEvento(_prevState: CrearEventoState, formData: FormData): Promise<CrearEventoState> {
  const membresia = await requireAdminEmpresaActivo();

  // El slug se normaliza siempre, y si viene vacío se deriva del nombre. Así la
  // dirección es válida por construcción en vez de rebotar al usuario con un
  // error de formato por haber escrito una tilde o un espacio, y el formulario
  // sigue funcionando aunque el JavaScript no haya cargado.
  const nombreCrudo = formData.get("nombre");
  const slugCrudo = formData.get("slug");
  const slugPedido = typeof slugCrudo === "string" ? slugCrudo.trim() : "";
  const slug = generarSlug(slugPedido || (typeof nombreCrudo === "string" ? nombreCrudo : ""));

  if (!slug) {
    return {
      status: "error",
      errors: { slug: ["Ponle un nombre con letras o números para poder formar la dirección."] },
    };
  }

  const parsed = crearEventoSchema.safeParse({
    nombre: nombreCrudo,
    slug,
    descripcion: formData.get("descripcion"),
    fechaInicio: formData.get("fechaInicio"),
    fechaLimiteInscripcion: formData.get("fechaLimiteInscripcion"),
    direccion: formData.get("direccion"),
  });

  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eventos")
    .insert({
      empresa_id: membresia.empresaId,
      nombre: parsed.data.nombre,
      slug: parsed.data.slug,
      descripcion: sanearHtml(parsed.data.descripcion) || null,
      // La hora se interpreta en la zona del evento, no en la del servidor:
      // `new Date("2026-11-15T06:30")` usaría la del proceso (UTC en producción)
      // y guardaría la hora desplazada.
      fecha_inicio: fechaLocalAIso(parsed.data.fechaInicio),
      fecha_limite_inscripcion: parsed.data.fechaLimiteInscripcion
        ? fechaLocalAIso(parsed.data.fechaLimiteInscripcion)
        : null,
      direccion: parsed.data.direccion || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    // Con el slug derivado del nombre, dos carreras parecidas chocan más a
    // menudo: conviene decir qué pasa y qué hacer, no soltar el error de Postgres.
    const duplicado = error?.message.includes("eventos_slug_key");
    return {
      status: "error",
      message: duplicado
        ? `La dirección /eventos/${slug} ya la usa otra carrera. Cambia el identificador de URL, por ejemplo añadiéndole el año.`
        : "No se pudo crear el evento: " + (error?.message ?? ""),
    };
  }

  revalidatePath("/panel/eventos");
  redirect(`/panel/eventos/${data.id}`);
}

export async function cambiarEstadoEvento(eventoId: string, nuevoEstado: EstadoEvento) {
  // Guarda por recurso: comprueba la membresía sobre la empresa dueña del evento,
  // no sobre la que esté seleccionada en el panel.
  await requireAdminDeEvento(eventoId);

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("slug")
    .eq("id", eventoId)
    .maybeSingle();

  const { error } = await supabase.from("eventos").update({ estado: nuevoEstado }).eq("id", eventoId);
  if (error) throw new Error("No se pudo actualizar el estado: " + error.message);

  revalidatePath(`/panel/eventos/${eventoId}`, "layout");
  revalidatePath("/panel/eventos");
  // Publicar o cerrar cambia lo que ve el público: hay que revalidar su portada.
  if (evento?.slug) revalidatePath(`/eventos/${evento.slug}`);
  revalidatePath("/eventos");
  revalidatePath("/");
}

