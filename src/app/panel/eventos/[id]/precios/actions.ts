"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminDeEvento } from "@/lib/auth/session";
import { precioEscalonadoSchema } from "@/lib/validacion/eventos";
import { fechaLocalAIso } from "@/lib/format";

export type PrecioState = {
  status: "idle" | "error" | "guardado";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export async function guardarPrecio(
  eventoId: string,
  precioId: string | null,
  _prevState: PrecioState,
  formData: FormData
): Promise<PrecioState> {
  await requireAdminDeEvento(eventoId);

  const parsed = precioEscalonadoSchema.safeParse({
    categoriaId: formData.get("categoriaId"),
    nombre: formData.get("nombre"),
    precio: formData.get("precio"),
    fechaInicio: formData.get("fechaInicio"),
    fechaFin: formData.get("fechaFin"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("slug, zona_horaria")
    .eq("id", eventoId)
    .maybeSingle();
  const zona = evento?.zona_horaria;

  // La categoría tiene que ser de ESTA carrera. `requireAdminDeEvento` solo
  // comprueba el evento de la URL, así que sin esto se podía crear un tramo de
  // precios sobre una categoría de otra carrera de la misma empresa pasando su
  // id a mano, y el organizador lo vería aparecer donde no lo puso.
  const { data: categoria } = await supabase
    .from("categorias")
    .select("id")
    .eq("id", d.categoriaId)
    .eq("evento_id", eventoId)
    .maybeSingle();
  if (!categoria) {
    return { status: "error", message: "Esa categoría no pertenece a esta carrera." };
  }

  const inicio = fechaLocalAIso(d.fechaInicio, zona);
  const fin = fechaLocalAIso(d.fechaFin, zona);

  // Dos tramos solapados dejarían el precio a merced de cuál devuelva primero la
  // consulta: el corredor pagaría uno u otro sin criterio. Se comprueba aquí
  // porque un constraint de exclusión exigiría la extensión btree_gist.
  const { data: existentes } = await supabase
    .from("precios_escalonados")
    .select("id, nombre, fecha_inicio, fecha_fin")
    .eq("categoria_id", d.categoriaId);

  const solapa = (existentes ?? []).find(
    (p) => p.id !== precioId && p.fecha_inicio < fin && inicio < p.fecha_fin
  );
  if (solapa) {
    return {
      status: "error",
      message: `Se solapa con el tramo «${solapa.nombre}». Ajusta las fechas para que no coincidan.`,
    };
  }

  const valores = {
    categoria_id: d.categoriaId,
    nombre: d.nombre,
    precio: d.precio,
    fecha_inicio: inicio,
    fecha_fin: fin,
  };

  // En el update se vuelve a atar el tramo a las categorías de esta carrera, por
  // el mismo motivo que arriba: `precioId` también llega del cliente.
  const { data: categoriasDelEvento } = await supabase
    .from("categorias")
    .select("id")
    .eq("evento_id", eventoId);
  const idsCategorias = (categoriasDelEvento ?? []).map((c) => c.id);

  const { error } = precioId
    ? await supabase
        .from("precios_escalonados")
        .update(valores)
        .eq("id", precioId)
        .in("categoria_id", idsCategorias)
    : await supabase.from("precios_escalonados").insert(valores);

  if (error) return { status: "error", message: "No se pudo guardar: " + error.message };

  revalidatePath(`/panel/eventos/${eventoId}/precios`);
  if (evento?.slug) revalidatePath(`/eventos/${evento.slug}`);
  return { status: "guardado" };
}

export async function eliminarPrecio(eventoId: string, precioId: string) {
  await requireAdminDeEvento(eventoId);

  const supabase = await createClient();
  // Acotado a las categorías de esta carrera: `precioId` viene del cliente.
  const { data: categoriasDelEvento } = await supabase
    .from("categorias")
    .select("id")
    .eq("evento_id", eventoId);

  const { error } = await supabase
    .from("precios_escalonados")
    .delete()
    .eq("id", precioId)
    .in(
      "categoria_id",
      (categoriasDelEvento ?? []).map((c) => c.id)
    );
  if (error) throw new Error("No se pudo eliminar: " + error.message);

  const { data: evento } = await supabase.from("eventos").select("slug").eq("id", eventoId).maybeSingle();
  revalidatePath(`/panel/eventos/${eventoId}/precios`);
  if (evento?.slug) revalidatePath(`/eventos/${evento.slug}`);
}
