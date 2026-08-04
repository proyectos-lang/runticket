"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { opcional } from "@/lib/validacion/comun";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerDeclaracionVigente } from "@/lib/declaraciones";
import { generarPdfDeclaracion } from "@/lib/pdf/declaracion";
import { formatFechaHora, formatPrecio } from "@/lib/format";
import { dentroDelLimite, MENSAJE_LIMITE, auditar } from "@/lib/seguridad";

export type InscripcionState = {
  status: "idle" | "error";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

const inscripcionSchema = z.object({
  categoriaId: z.uuid("Selecciona una categoría."),
  talla: opcional(z.string().trim().max(20)),
  club: opcional(z.string().trim().max(80)),
  equipo: opcional(z.string().trim().max(80)),
  alergias: opcional(z.string().trim().max(300)),
  // Solo se renderizan si el participante es menor: llegan como null en el resto
  // de los casos, de ahí que tengan que tolerarlo.
  tutorNombre: opcional(z.string().trim().max(80)),
  tutorDocumento: opcional(z.string().trim().max(40)),
  firmaPng: opcional(z.string()),
  codigoCupon: opcional(z.string().trim().max(30)),
  acepto: z.literal("on", { message: "Debes aceptar la declaración de salud para inscribirte." }),
});

/** Traduce los errores que levanta la función SQL a algo que entienda el corredor. */
function mensajeDeError(error: string): string {
  if (error.includes("CUPO_AGOTADO")) {
    return "Se agotó el cupo de esta categoría mientras completabas el formulario. Elige otra o apúntate a la lista de espera.";
  }
  if (error.includes("CUPON_CADUCADO")) return "Ese cupón ya caducó.";
  if (error.includes("CUPON_AGOTADO")) {
    return "Ese cupón alcanzó su número máximo de usos mientras completabas el formulario.";
  }
  if (error.includes("CUPON_INVALIDO")) return "El código de descuento no es válido para esta carrera.";
  if (error.includes("duplicate key") && error.includes("evento_corredor")) {
    return "Ya tienes una inscripción activa en este evento.";
  }
  return error.replace(/^.*?:\s*/, "");
}

export async function inscribirse(
  slug: string,
  _prevState: InscripcionState,
  formData: FormData
): Promise<InscripcionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/eventos/${slug}/inscripcion`);

  if (!(await dentroDelLimite("inscripcion"))) {
    return { status: "error", message: MENSAJE_LIMITE };
  }

  const parsed = inscripcionSchema.safeParse({
    categoriaId: formData.get("categoriaId"),
    talla: formData.get("talla"),
    club: formData.get("club"),
    equipo: formData.get("equipo"),
    alergias: formData.get("alergias"),
    tutorNombre: formData.get("tutorNombre"),
    tutorDocumento: formData.get("tutorDocumento"),
    firmaPng: formData.get("firmaPng"),
    codigoCupon: formData.get("codigoCupon"),
    acepto: formData.get("acepto"),
  });

  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const { data: evento } = await supabase
    .from("eventos")
    .select("id, nombre, empresa_id, fecha_inicio, zona_horaria")
    .eq("slug", slug)
    .maybeSingle();
  if (!evento) return { status: "error", message: "Este evento ya no está disponible." };

  const declaracion = await obtenerDeclaracionVigente(evento.empresa_id, evento.id);

  const cabeceras = await headers();
  const ip = cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const dispositivo = cabeceras.get("user-agent");

  // Toda la parte crítica (cupo, inventario de talla, inscripción y firma) ocurre
  // dentro de una única transacción en la base de datos.
  const { data: inscripcionId, error } = await supabase.rpc("inscribirse_en_evento", {
    p_categoria_id: d.categoriaId,
    p_declaracion_id: declaracion.id,
    p_talla: d.talla || null,
    p_datos_adicionales: {
      club: d.club || null,
      equipo: d.equipo || null,
      alergias: d.alergias || null,
    },
    p_firma_imagen_url: null,
    p_acepto: true,
    p_ip: ip,
    p_dispositivo: dispositivo,
    p_tutor_nombre: d.tutorNombre || null,
    p_tutor_documento: d.tutorDocumento || null,
    // El código viaja tal cual: el descuento lo calcula la base de datos, que es
    // la única que puede fijar el precio de forma confiable.
    p_codigo_cupon: d.codigoCupon || null,
  });

  if (error || !inscripcionId) {
    return { status: "error", message: mensajeDeError(error?.message ?? "No se pudo completar la inscripción.") };
  }

  // A partir de aquí la inscripción ya existe: si falla la generación del PDF no
  // se pierde la plaza, solo queda el documento pendiente de adjuntar.
  try {
    await adjuntarDocumentos({
      inscripcionId,
      empresaId: evento.empresa_id,
      eventoNombre: evento.nombre,
      fechaEvento: formatFechaHora(evento.fecha_inicio, evento.zona_horaria),
      categoriaId: d.categoriaId,
      firmaPng: d.firmaPng || null,
      declaracion,
      ip,
      dispositivo,
      tutorNombre: d.tutorNombre || null,
      tutorDocumento: d.tutorDocumento || null,
      usuarioId: user.id,
      correo: user.email ?? "",
    });
  } catch (e) {
    console.error("No se pudieron adjuntar los documentos de la inscripción", inscripcionId, e);
  }

  await auditar({
    accion: "inscripcion.crear",
    entidad: "inscripciones",
    entidadId: inscripcionId,
    empresaId: evento.empresa_id,
    datosNuevos: { categoria_id: d.categoriaId, talla: d.talla || null, origen: "portal" },
  });

  revalidatePath(`/eventos/${slug}`);
  redirect(`/portal/inscripciones/${inscripcionId}?nueva=1`);
}

export type CuponState =
  | { status: "idle" }
  | { status: "valido"; descripcion: string }
  | { status: "invalido"; message: string };

/**
 * Comprueba un código antes de enviar el formulario, solo para dar una respuesta
 * inmediata. **El descuento real lo aplica la base de datos** al inscribirse: si
 * el precio saliera de aquí, lo estaría fijando el navegador.
 */
export async function comprobarCupon(slug: string, codigo: string): Promise<CuponState> {
  if (!codigo.trim()) return { status: "idle" };

  if (!(await dentroDelLimite("cupon"))) {
    return { status: "invalido", message: "Demasiados intentos. Espera unos minutos." };
  }

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("id, empresa_id, moneda")
    .eq("slug", slug)
    .maybeSingle();
  if (!evento) return { status: "invalido", message: "Evento no disponible." };

  const { data, error } = await supabase.rpc("validar_cupon", {
    p_empresa_id: evento.empresa_id,
    p_evento_id: evento.id,
    p_codigo: codigo.trim().toUpperCase(),
  });

  const resultado = data?.[0];
  if (error || !resultado?.valido) {
    return { status: "invalido", message: resultado?.motivo ?? "Código no válido." };
  }

  return {
    status: "valido",
    descripcion:
      resultado.tipo_descuento === "porcentaje"
        ? `${resultado.valor} % de descuento`
        : `${formatPrecio(Number(resultado.valor), evento.moneda)} de descuento`,
  };
}

export type EsperaState = { status: "idle" | "error" | "apuntado"; message?: string };

/**
 * Apunta al corredor a la lista de espera de una categoría llena.
 *
 * La política de la tabla acepta cualquier evento "visible al público", lo que
 * incluye los cerrados y los ya celebrados; aquí se restringe a `publicado`,
 * que es lo único que tiene sentido.
 */
export async function apuntarseListaEspera(
  slug: string,
  categoriaId: string
): Promise<EsperaState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/eventos/${slug}/inscripcion`);

  const { data: evento } = await supabase
    .from("eventos")
    .select("id, estado")
    .eq("slug", slug)
    .maybeSingle();
  if (!evento) return { status: "error", message: "Este evento ya no está disponible." };
  if (evento.estado !== "publicado") {
    return { status: "error", message: "Este evento ya no admite lista de espera." };
  }

  const { error } = await supabase.from("lista_espera").insert({
    evento_id: evento.id,
    categoria_id: categoriaId,
    usuario_id: user.id,
  });

  if (error) {
    // 23505: el índice único parcial impide apuntarse dos veces a la misma categoría.
    if (error.code === "23505") {
      return { status: "error", message: "Ya estás en la lista de espera de esta categoría." };
    }
    return { status: "error", message: "No se pudo apuntar: " + error.message };
  }

  revalidatePath(`/eventos/${slug}/inscripcion`);
  return { status: "apuntado" };
}

async function adjuntarDocumentos(args: {
  inscripcionId: string;
  empresaId: string;
  eventoNombre: string;
  fechaEvento: string;
  categoriaId: string;
  firmaPng: string | null;
  declaracion: { id: string; version: number; contenido: string };
  ip: string | null;
  dispositivo: string | null;
  tutorNombre: string | null;
  tutorDocumento: string | null;
  usuarioId: string;
  correo: string;
}) {
  const admin = createAdminClient();
  const carpeta = `${args.empresaId}/${args.inscripcionId}`;

  const [{ data: perfil }, { data: categoria }, { data: empresa }] = await Promise.all([
    admin
      .from("perfiles")
      .select("nombres, apellidos, documento_identidad")
      .eq("id", args.usuarioId)
      .single(),
    admin.from("categorias").select("nombre").eq("id", args.categoriaId).single(),
    admin.from("empresas").select("nombre_comercial").eq("id", args.empresaId).single(),
  ]);

  let firmaUrl: string | null = null;
  if (args.firmaPng?.startsWith("data:image/png;base64,")) {
    const binario = Buffer.from(args.firmaPng.split(",")[1], "base64");
    const ruta = `${carpeta}/firma.png`;
    const { error } = await admin.storage
      .from("declaraciones")
      .upload(ruta, binario, { contentType: "image/png", upsert: true });
    if (!error) firmaUrl = ruta;
  }

  const pdf = await generarPdfDeclaracion({
    evento: args.eventoNombre,
    empresa: empresa?.nombre_comercial ?? "",
    fechaEvento: args.fechaEvento,
    categoria: categoria?.nombre ?? "",
    corredor: `${perfil?.nombres ?? ""} ${perfil?.apellidos ?? ""}`.trim(),
    documento: perfil?.documento_identidad,
    correo: args.correo,
    version: args.declaracion.version,
    contenido: args.declaracion.contenido,
    firmadoEn: new Date(),
    ip: args.ip,
    dispositivo: args.dispositivo,
    tutorNombre: args.tutorNombre,
    tutorDocumento: args.tutorDocumento,
    firmaPng: args.firmaPng,
  });

  const rutaPdf = `${carpeta}/declaracion.pdf`;
  const { error: errorPdf } = await admin.storage
    .from("declaraciones")
    .upload(rutaPdf, pdf, { contentType: "application/pdf", upsert: true });

  await admin
    .from("inscripcion_firmas")
    .update({
      firma_imagen_url: firmaUrl,
      pdf_url: errorPdf ? null : rutaPdf,
    })
    .eq("inscripcion_id", args.inscripcionId);
}
