"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminDeEvento } from "@/lib/auth/session";
import {
  editarEventoSchema,
  ubicacionSchema,
  categoriaSchema,
  tallaSchema,
} from "@/lib/validacion/eventos";
import { fechaLocalAIso } from "@/lib/format";
import { generarSlug } from "@/lib/slug";
import {
  prefijoEvento,
  rutaEvento,
  rutaDesdeUrlPublica,
  urlPublicaValida,
} from "@/lib/storage/rutas";
import { pareceGpxValido, TAMANO_MAXIMO_GPX } from "@/lib/mapas/gpx";
import { sanearHtml } from "@/lib/sanitizar";

export type EventoState = {
  status: "idle" | "error" | "guardado";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

/** Revalida el panel y también las rutas públicas que dependen del slug. */
function revalidarEvento(eventoId: string, slugs: (string | null | undefined)[]) {
  revalidatePath(`/panel/eventos/${eventoId}`, "layout");
  revalidatePath("/panel/eventos");
  for (const slug of new Set(slugs.filter(Boolean) as string[])) {
    revalidatePath(`/eventos/${slug}`);
    revalidatePath(`/eventos/${slug}/inscripcion`);
    revalidatePath(`/eventos/${slug}/resultados`);
  }
  revalidatePath("/eventos");
  revalidatePath("/");
}

export async function actualizarEvento(
  eventoId: string,
  _prevState: EventoState,
  formData: FormData
): Promise<EventoState> {
  await requireAdminDeEvento(eventoId);
  const supabase = await createClient();

  const { data: actual } = await supabase
    .from("eventos")
    .select("slug, estado, zona_horaria, moneda")
    .eq("id", eventoId)
    .maybeSingle();
  if (!actual) return { status: "error", message: "El evento ya no existe." };

  const parsed = editarEventoSchema.safeParse({
    nombre: formData.get("nombre"),
    // Cambiar el slug rompe enlaces ya compartidos, los .ics que la gente añadió a
    // su calendario y las notificaciones ya emitidas: solo se admite en borrador,
    // y no basta con el `disabled` del HTML.
    //
    // En borrador se normaliza igual que al crear, y si se deja vacío se vuelve a
    // derivar del nombre: así el campo nunca deja la carrera sin dirección.
    slug:
      actual.estado === "borrador"
        ? generarSlug(String(formData.get("slug") ?? "").trim() || String(formData.get("nombre") ?? ""))
        : actual.slug,
    descripcion: formData.get("descripcion"),
    fechaInicio: formData.get("fechaInicio"),
    fechaLimiteInscripcion: formData.get("fechaLimiteInscripcion"),
    direccion: formData.get("direccion"),
    moneda: formData.get("moneda"),
    zonaHoraria: formData.get("zonaHoraria"),
    disciplina: formData.get("disciplina"),
    departamentoId: formData.get("departamentoId"),
    kitContenido: formData.get("kitContenido"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  // La moneda se copia a cada inscripción al inscribirse; cambiarla después
  // dejaría importes en monedas mezcladas dentro de la misma conciliación.
  const { count: inscripciones } = await supabase
    .from("inscripciones")
    .select("*", { count: "exact", head: true })
    .eq("evento_id", eventoId);

  if ((inscripciones ?? 0) > 0 && d.moneda !== actual.moneda) {
    return {
      status: "error",
      message: `Ya hay ${inscripciones} inscripciones cobradas en ${actual.moneda}: la moneda no se puede cambiar.`,
    };
  }

  // Se sanea antes de guardar: la descripción se renderiza como HTML en la ficha
  // pública, así que aquí es donde se corta cualquier script. El largo se mide
  // sobre el resultado limpio, no sobre el marcado original.
  const descripcion = sanearHtml(d.descripcion);
  if (descripcion.length > 20000) {
    return { status: "error", message: "La descripción es demasiado larga. Recórtala un poco." };
  }

  // Una línea por artículo. Se descartan las vacías para que un salto de línea
  // suelto no se convierta en un punto en blanco en la ficha pública.
  const kit = (d.kitContenido ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const zona = d.zonaHoraria;
  const { error } = await supabase
    .from("eventos")
    .update({
      nombre: d.nombre,
      slug: d.slug,
      descripcion: descripcion || null,
      fecha_inicio: fechaLocalAIso(d.fechaInicio, zona),
      fecha_limite_inscripcion: d.fechaLimiteInscripcion
        ? fechaLocalAIso(d.fechaLimiteInscripcion, zona)
        : null,
      direccion: d.direccion || null,
      moneda: d.moneda.toUpperCase(),
      zona_horaria: zona,
      disciplina: d.disciplina,
      departamento_id: d.departamentoId ?? null,
      // La columna es `not null default '{}'`: sin contenido va la lista vacía,
      // nunca null.
      kit_contenido: kit,
    })
    .eq("id", eventoId);

  if (error) {
    const mensaje = error.message.includes("eventos_slug_key")
      ? "Ese identificador de URL ya lo usa otro evento."
      : "No se pudo guardar: " + error.message;
    return { status: "error", message: mensaje };
  }

  revalidarEvento(eventoId, [actual.slug, d.slug]);
  return { status: "guardado" };
}

export async function actualizarUbicacion(
  eventoId: string,
  _prevState: EventoState,
  formData: FormData
): Promise<EventoState> {
  await requireAdminDeEvento(eventoId);

  const parsed = ubicacionSchema.safeParse({
    direccion: formData.get("direccion"),
    lat: formData.get("lat"),
    lng: formData.get("lng"),
    puntoEncuentroLat: formData.get("puntoEncuentroLat"),
    puntoEncuentroLng: formData.get("puntoEncuentroLng"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: actual } = await supabase
    .from("eventos")
    .select("slug")
    .eq("id", eventoId)
    .maybeSingle();

  const { error } = await supabase
    .from("eventos")
    .update({
      direccion: d.direccion || null,
      lat: d.lat ?? null,
      lng: d.lng ?? null,
      punto_encuentro_lat: d.puntoEncuentroLat ?? null,
      punto_encuentro_lng: d.puntoEncuentroLng ?? null,
    })
    .eq("id", eventoId);

  if (error) return { status: "error", message: "No se pudo guardar: " + error.message };

  revalidarEvento(eventoId, [actual?.slug]);
  return { status: "guardado" };
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

export type CategoriaState = {
  status: "idle" | "error" | "guardado";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

/** Crea o actualiza según venga `categoriaId`: el formulario es el mismo. */
export async function guardarCategoria(
  eventoId: string,
  categoriaId: string | null,
  _prevState: CategoriaState,
  formData: FormData
): Promise<CategoriaState> {
  await requireAdminDeEvento(eventoId);

  const parsed = categoriaSchema.safeParse({
    nombre: formData.get("nombre"),
    distanciaKm: formData.get("distanciaKm"),
    desnivelM: formData.get("desnivelM"),
    precioBase: formData.get("precioBase"),
    cupoMaximo: formData.get("cupoMaximo"),
    edadMinima: formData.get("edadMinima"),
    edadMaxima: formData.get("edadMaxima"),
    horaSalida: formData.get("horaSalida"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  if (d.edadMinima !== undefined && d.edadMaxima !== undefined && d.edadMinima > d.edadMaxima) {
    return { status: "error", message: "La edad mínima no puede ser mayor que la máxima." };
  }

  const supabase = await createClient();
  const valores = {
    nombre: d.nombre,
    distancia_km: d.distanciaKm ?? null,
    desnivel_m: d.desnivelM ?? null,
    precio_base: d.precioBase,
    cupo_maximo: d.cupoMaximo ?? null,
    edad_minima: d.edadMinima ?? null,
    edad_maxima: d.edadMaxima ?? null,
    hora_salida: d.horaSalida || null,
  };

  if (categoriaId) {
    // Bajar el cupo por debajo de los ya inscritos dejaría la categoría en
    // sobreventa permanente.
    if (d.cupoMaximo !== undefined) {
      const { count } = await supabase
        .from("inscripciones")
        .select("*", { count: "exact", head: true })
        .eq("categoria_id", categoriaId)
        .eq("estado", "activa");
      if ((count ?? 0) > d.cupoMaximo) {
        return {
          status: "error",
          message: `Ya hay ${count} inscritos en esta categoría: el cupo no puede ser menor.`,
        };
      }
    }
    const { error } = await supabase.from("categorias").update(valores).eq("id", categoriaId);
    if (error) return { status: "error", message: "No se pudo guardar: " + error.message };
  } else {
    const { error } = await supabase.from("categorias").insert({ evento_id: eventoId, ...valores });
    if (error) return { status: "error", message: "No se pudo crear: " + error.message };
  }

  const { data: evento } = await supabase.from("eventos").select("slug").eq("id", eventoId).maybeSingle();
  revalidarEvento(eventoId, [evento?.slug]);
  revalidatePath(`/panel/eventos/${eventoId}/categorias`);
  return { status: "guardado" };
}

export async function eliminarCategoria(eventoId: string, categoriaId: string) {
  await requireAdminDeEvento(eventoId);
  const supabase = await createClient();

  const { count } = await supabase
    .from("inscripciones")
    .select("*", { count: "exact", head: true })
    .eq("categoria_id", categoriaId);
  if ((count ?? 0) > 0) {
    throw new Error(
      `Hay ${count} inscripciones en esta categoría. Elimínalas o anúlalas antes de borrarla.`
    );
  }

  const { error } = await supabase.from("categorias").delete().eq("id", categoriaId);
  if (error) throw new Error("No se pudo eliminar: " + error.message);

  const { data: evento } = await supabase.from("eventos").select("slug").eq("id", eventoId).maybeSingle();
  revalidarEvento(eventoId, [evento?.slug]);
  revalidatePath(`/panel/eventos/${eventoId}/categorias`);
}

// ---------------------------------------------------------------------------
// Tallas e inventario
// ---------------------------------------------------------------------------

export type TallaState = {
  status: "idle" | "error" | "guardado";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export async function crearTalla(
  eventoId: string,
  _prevState: TallaState,
  formData: FormData
): Promise<TallaState> {
  await requireAdminDeEvento(eventoId);

  const parsed = tallaSchema.safeParse({
    talla: formData.get("talla"),
    inventarioTotal: formData.get("inventarioTotal"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("evento_tallas").insert({
    evento_id: eventoId,
    talla: parsed.data.talla,
    inventario_total: parsed.data.inventarioTotal ?? null,
    inventario_disponible: parsed.data.inventarioTotal ?? null,
  });
  if (error) {
    const mensaje = error.message.includes("duplicate")
      ? "Esa talla ya está configurada en este evento."
      : "No se pudo agregar: " + error.message;
    return { status: "error", message: mensaje };
  }

  revalidatePath(`/panel/eventos/${eventoId}/tallas`);
  return { status: "guardado" };
}

/**
 * Fija el inventario total de una talla. Va por RPC porque hay que recalcular el
 * disponible contra las prendas ya comprometidas dentro de la misma transacción:
 * tres funciones distintas mueven ese contador por delta.
 */
export async function ajustarInventario(eventoId: string, tallaId: string, total: number | null) {
  await requireAdminDeEvento(eventoId);

  const supabase = await createClient();
  const { error } = await supabase.rpc("ajustar_inventario_talla", {
    p_talla_id: tallaId,
    p_inventario_total: total,
  });
  if (error) throw new Error(error.message.replace(/^.*?:\s*/, ""));

  revalidatePath(`/panel/eventos/${eventoId}/tallas`);
}

export async function eliminarTalla(eventoId: string, tallaId: string) {
  await requireAdminDeEvento(eventoId);

  const supabase = await createClient();
  const { error } = await supabase.from("evento_tallas").delete().eq("id", tallaId);
  // El trigger `proteger_talla_en_uso` lo impide si hay inscritos con esa talla.
  if (error) throw new Error(error.message.replace(/^.*?:\s*/, ""));

  revalidatePath(`/panel/eventos/${eventoId}/tallas`);
}

// ---------------------------------------------------------------------------
// Imágenes
// ---------------------------------------------------------------------------

/**
 * El archivo lo sube el navegador, así que la URL que llega aquí no es de fiar:
 * se comprueba que apunte al bucket y a la carpeta de ESTE evento antes de
 * guardarla. Sin esto se podría inyectar la URL de cualquier otro sitio.
 */
async function exigirUrlDelEvento(url: string, empresaId: string, eventoId: string) {
  if (!urlPublicaValida(url, "eventos", prefijoEvento(empresaId, eventoId))) {
    throw new Error("La imagen no pertenece a este evento.");
  }
}

export async function guardarBanner(eventoId: string, url: string) {
  const { empresaId } = await requireAdminDeEvento(eventoId);
  await exigirUrlDelEvento(url, empresaId, eventoId);

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("slug, imagen_banner_url")
    .eq("id", eventoId)
    .maybeSingle();

  const { error } = await supabase.from("eventos").update({ imagen_banner_url: url }).eq("id", eventoId);
  if (error) throw new Error("No se pudo guardar la portada: " + error.message);

  const anterior = evento?.imagen_banner_url && rutaDesdeUrlPublica(evento.imagen_banner_url, "eventos");
  if (anterior) await supabase.storage.from("eventos").remove([anterior]);

  revalidarEvento(eventoId, [evento?.slug]);
  revalidatePath(`/panel/eventos/${eventoId}/imagenes`);
}

export async function quitarBanner(eventoId: string) {
  await requireAdminDeEvento(eventoId);
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select("slug, imagen_banner_url")
    .eq("id", eventoId)
    .maybeSingle();

  await supabase.from("eventos").update({ imagen_banner_url: null }).eq("id", eventoId);

  const ruta = evento?.imagen_banner_url && rutaDesdeUrlPublica(evento.imagen_banner_url, "eventos");
  if (ruta) await supabase.storage.from("eventos").remove([ruta]);

  revalidarEvento(eventoId, [evento?.slug]);
  revalidatePath(`/panel/eventos/${eventoId}/imagenes`);
}

export async function agregarImagenes(eventoId: string, urls: string[]) {
  const { empresaId } = await requireAdminDeEvento(eventoId);
  for (const url of urls) await exigirUrlDelEvento(url, empresaId, eventoId);

  const supabase = await createClient();
  const { data: ultimas } = await supabase
    .from("evento_imagenes")
    .select("orden")
    .eq("evento_id", eventoId)
    .order("orden", { ascending: false })
    .limit(1);
  const siguiente = (ultimas?.[0]?.orden ?? -1) + 1;

  const { error } = await supabase
    .from("evento_imagenes")
    .insert(urls.map((url, i) => ({ evento_id: eventoId, url, orden: siguiente + i })));
  if (error) throw new Error("No se pudo guardar la galería: " + error.message);

  const { data: evento } = await supabase.from("eventos").select("slug").eq("id", eventoId).maybeSingle();
  revalidarEvento(eventoId, [evento?.slug]);
  revalidatePath(`/panel/eventos/${eventoId}/imagenes`);
}

export async function eliminarImagen(eventoId: string, imagenId: string) {
  await requireAdminDeEvento(eventoId);
  const supabase = await createClient();

  const { data: imagen } = await supabase
    .from("evento_imagenes")
    .select("url")
    .eq("id", imagenId)
    .maybeSingle();

  const { error } = await supabase.from("evento_imagenes").delete().eq("id", imagenId);
  if (error) throw new Error("No se pudo eliminar: " + error.message);

  // Storage no se limpia solo al borrar la fila.
  const ruta = imagen?.url && rutaDesdeUrlPublica(imagen.url, "eventos");
  if (ruta) await supabase.storage.from("eventos").remove([ruta]);

  const { data: evento } = await supabase.from("eventos").select("slug").eq("id", eventoId).maybeSingle();
  revalidarEvento(eventoId, [evento?.slug]);
  revalidatePath(`/panel/eventos/${eventoId}/imagenes`);
}

export async function moverImagen(eventoId: string, imagenId: string, direccion: -1 | 1) {
  await requireAdminDeEvento(eventoId);
  const supabase = await createClient();

  const { data: imagenes } = await supabase
    .from("evento_imagenes")
    .select("id, orden")
    .eq("evento_id", eventoId)
    .order("orden");
  if (!imagenes) return;

  const i = imagenes.findIndex((x) => x.id === imagenId);
  const j = i + direccion;
  if (i === -1 || j < 0 || j >= imagenes.length) return;

  // Se reescribe el orden completo: es barato y evita quedarse con huecos o
  // empates si alguna fila traía un orden repetido.
  const reordenadas = [...imagenes];
  [reordenadas[i], reordenadas[j]] = [reordenadas[j], reordenadas[i]];

  for (const [orden, img] of reordenadas.entries()) {
    await supabase.from("evento_imagenes").update({ orden }).eq("id", img.id);
  }

  const { data: evento } = await supabase.from("eventos").select("slug").eq("id", eventoId).maybeSingle();
  revalidarEvento(eventoId, [evento?.slug]);
  revalidatePath(`/panel/eventos/${eventoId}/imagenes`);
}

// ---------------------------------------------------------------------------
// Ruta GPX
// ---------------------------------------------------------------------------

export type GpxState = { status: "idle" | "error" | "guardado"; message?: string };

/**
 * El GPX sí pasa por Server Action (a diferencia de las imágenes): son archivos
 * de texto de unos pocos cientos de kB, muy por debajo del tope de 1 MB, y así se
 * puede validar el contenido antes de guardarlo.
 */
export async function guardarGpx(
  eventoId: string,
  _prevState: GpxState,
  formData: FormData
): Promise<GpxState> {
  const { empresaId } = await requireAdminDeEvento(eventoId);

  const archivo = formData.get("gpx");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { status: "error", message: "Selecciona un archivo .gpx." };
  }
  if (archivo.size > TAMANO_MAXIMO_GPX) {
    return { status: "error", message: "El archivo supera los 5 MB." };
  }

  const contenido = await archivo.text();
  if (!pareceGpxValido(contenido)) {
    return {
      status: "error",
      message: "El archivo no parece un GPX con recorrido: no encontramos puntos de ruta.",
    };
  }

  const supabase = await createClient();
  const ruta = rutaEvento(empresaId, eventoId, `ruta-${Date.now()}.gpx`);
  const { error: errorSubida } = await supabase.storage
    .from("eventos")
    .upload(ruta, contenido, { contentType: "application/gpx+xml" });
  if (errorSubida) {
    return { status: "error", message: "No se pudo subir: " + errorSubida.message };
  }

  const { data: publica } = supabase.storage.from("eventos").getPublicUrl(ruta);
  const { data: evento } = await supabase
    .from("eventos")
    .select("slug, ruta_gpx_url")
    .eq("id", eventoId)
    .maybeSingle();

  const { error } = await supabase
    .from("eventos")
    .update({ ruta_gpx_url: publica.publicUrl })
    .eq("id", eventoId);
  if (error) return { status: "error", message: "No se pudo guardar: " + error.message };

  // Se limpia el anterior: Storage no tiene cascada desde la base de datos.
  const anterior = evento?.ruta_gpx_url && rutaDesdeUrlPublica(evento.ruta_gpx_url, "eventos");
  if (anterior) await supabase.storage.from("eventos").remove([anterior]);

  revalidarEvento(eventoId, [evento?.slug]);
  revalidatePath(`/panel/eventos/${eventoId}/ubicacion`);
  return { status: "guardado" };
}

export async function quitarGpx(eventoId: string) {
  await requireAdminDeEvento(eventoId);
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select("slug, ruta_gpx_url")
    .eq("id", eventoId)
    .maybeSingle();

  await supabase.from("eventos").update({ ruta_gpx_url: null }).eq("id", eventoId);

  const ruta = evento?.ruta_gpx_url && rutaDesdeUrlPublica(evento.ruta_gpx_url, "eventos");
  if (ruta) await supabase.storage.from("eventos").remove([ruta]);

  revalidarEvento(eventoId, [evento?.slug]);
  revalidatePath(`/panel/eventos/${eventoId}/ubicacion`);
}

// ---------------------------------------------------------------------------
// Lista de espera
// ---------------------------------------------------------------------------

/**
 * Avisa al primero de la cola. La RPC caduca antes las ventanas vencidas y
 * rechaza notificar si ya hay alguien con la suya abierta: el cupo es uno y
 * notificar a varios a la vez sería prometer lo mismo dos veces.
 *
 * No se expone "convertir en inscripción": crearía una inscripción sin
 * declaración de salud firmada. El corredor completa el flujo normal.
 */
export async function notificarSiguienteEnEspera(eventoId: string, categoriaId: string) {
  await requireAdminDeEvento(eventoId);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("notificar_siguiente_lista_espera", {
    p_categoria_id: categoriaId,
  });
  if (error) throw new Error(error.message.replace(/^.*?:\s*/, ""));

  revalidatePath(`/panel/eventos/${eventoId}/lista-espera`);
  if (!data) throw new Error("No hay nadie esperando en esta categoría.");
}

export async function quitarDeListaEspera(eventoId: string, listaEsperaId: string) {
  await requireAdminDeEvento(eventoId);

  const supabase = await createClient();
  const { error } = await supabase.from("lista_espera").delete().eq("id", listaEsperaId);
  if (error) throw new Error("No se pudo quitar de la lista: " + error.message);

  revalidatePath(`/panel/eventos/${eventoId}/lista-espera`);
}

export type BorradoState = { status: "idle" | "error"; message?: string };

/**
 * Borrado duro, solo para eventos que nunca llegaron a operar. `inscripciones`
 * cuelga del evento con ON DELETE CASCADE, así que borrar uno con inscritos se
 * llevaría por delante sus declaraciones firmadas y sus pagos. Un trigger lo
 * impide también en la base de datos; aquí se da el mensaje entendible.
 */
export async function eliminarEvento(
  eventoId: string,
  _prevState: BorradoState,
  formData: FormData
): Promise<BorradoState> {
  const { empresaId } = await requireAdminDeEvento(eventoId);
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select("nombre, slug, estado")
    .eq("id", eventoId)
    .maybeSingle();
  if (!evento) return { status: "error", message: "El evento ya no existe." };

  if (formData.get("confirmacion") !== evento.nombre) {
    return { status: "error", message: "Escribe el nombre exacto del evento para confirmar." };
  }
  if (evento.estado !== "borrador") {
    return {
      status: "error",
      message: "Solo se puede eliminar un evento en borrador. Si ya se publicó, cancélalo.",
    };
  }

  const { count } = await supabase
    .from("inscripciones")
    .select("*", { count: "exact", head: true })
    .eq("evento_id", eventoId);
  if ((count ?? 0) > 0) {
    return {
      status: "error",
      message: `El evento tiene ${count} inscripciones. Cancélalo en vez de eliminarlo.`,
    };
  }

  const { error } = await supabase.from("eventos").delete().eq("id", eventoId);
  if (error) return { status: "error", message: error.message.replace(/^.*?:\s*/, "") };

  // La base de datos no borra los archivos: hay que limpiar el prefijo a mano.
  const carpeta = prefijoEvento(empresaId, eventoId);
  const { data: archivos } = await supabase.storage.from("eventos").list(carpeta);
  if (archivos?.length) {
    await supabase.storage.from("eventos").remove(archivos.map((a) => `${carpeta}/${a.name}`));
  }

  revalidarEvento(eventoId, [evento.slug]);
  redirect("/panel/eventos");
}
