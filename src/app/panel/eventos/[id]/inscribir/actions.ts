"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminDeEvento } from "@/lib/auth/session";
import { obtenerDeclaracionVigente } from "@/lib/declaraciones";
import { opcional } from "@/lib/validacion/comun";
import { auditar } from "@/lib/seguridad";

export type ManualState = {
  status: "idle" | "error";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

const manualSchema = z.object({
  categoriaId: z.uuid("Selecciona la categoría."),
  nombres: z.string().trim().min(2, "Introduce los nombres.").max(80),
  apellidos: z.string().trim().min(2, "Introduce los apellidos.").max(80),
  correo: z.email("Introduce un correo válido."),
  telefono: opcional(z.string().trim().max(30)),
  documentoIdentidad: opcional(z.string().trim().max(40)),
  fechaNacimiento: z.string().min(1, "Introduce la fecha de nacimiento."),
  sexo: z.enum(["masculino", "femenino", "otro"], { message: "Selecciona el sexo." }),
  contactoEmergenciaNombre: z.string().trim().min(2, "Introduce el contacto de emergencia.").max(80),
  contactoEmergenciaTelefono: z.string().trim().min(6, "Introduce el teléfono de emergencia.").max(30),
  talla: opcional(z.string().trim().max(20)),
  precio: opcional(z.string()),
  cobrarEfectivo: opcional(z.literal("on")),
  // Obligatoria: es la constancia del consentimiento. Antes no se pedía y
  // `aceptado_checkbox` quedaba en falso incluso habiendo firmado en la mesa.
  acepto: z.literal("on", { message: "Confirma que la persona aceptó la declaración." }),
  tutorNombre: opcional(z.string().trim().max(80)),
  tutorDocumento: opcional(z.string().trim().max(40)),
});

/**
 * Inscribe a alguien desde la mesa del evento. Si esa persona no tiene cuenta se
 * le crea una: hace falta para que después pueda ver su dorsal, su declaración
 * firmada y su certificado como cualquier otro corredor.
 */
export async function inscribirManualmente(
  eventoId: string,
  _prevState: ManualState,
  formData: FormData
): Promise<ManualState> {
  const { empresaId } = await requireAdminDeEvento(eventoId);

  const parsed = manualSchema.safeParse({
    categoriaId: formData.get("categoriaId"),
    nombres: formData.get("nombres"),
    apellidos: formData.get("apellidos"),
    correo: formData.get("correo"),
    telefono: formData.get("telefono"),
    documentoIdentidad: formData.get("documentoIdentidad"),
    fechaNacimiento: formData.get("fechaNacimiento"),
    sexo: formData.get("sexo"),
    contactoEmergenciaNombre: formData.get("contactoEmergenciaNombre"),
    contactoEmergenciaTelefono: formData.get("contactoEmergenciaTelefono"),
    talla: formData.get("talla"),
    precio: formData.get("precio"),
    cobrarEfectivo: formData.get("cobrarEfectivo"),
    acepto: formData.get("acepto"),
    tutorNombre: formData.get("tutorNombre"),
    tutorDocumento: formData.get("tutorDocumento"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const admin = createAdminClient();

  // ¿Ya existe esa persona? Si sí, se reutiliza su cuenta en vez de duplicarla.
  const { data: existente } = await admin
    .from("perfiles")
    .select("id")
    .ilike("correo", d.correo)
    .maybeSingle();

  let corredorId = existente?.id;
  if (!corredorId) {
    const { data: creado, error } = await admin.auth.admin.createUser({
      email: d.correo,
      email_confirm: true,
      user_metadata: { nombres: d.nombres, apellidos: d.apellidos },
    });
    if (error || !creado.user) {
      return { status: "error", message: "No se pudo crear la cuenta: " + (error?.message ?? "") };
    }
    corredorId = creado.user.id;
  }

  // El perfil se completa siempre: la RPC exige fecha de nacimiento para validar
  // la edad de la categoría.
  const { error: errorPerfil } = await admin
    .from("perfiles")
    .update({
      nombres: d.nombres,
      apellidos: d.apellidos,
      telefono: d.telefono || null,
      documento_identidad: d.documentoIdentidad || null,
      fecha_nacimiento: d.fechaNacimiento,
      sexo: d.sexo,
      contacto_emergencia_nombre: d.contactoEmergenciaNombre,
      contacto_emergencia_telefono: d.contactoEmergenciaTelefono,
    })
    .eq("id", corredorId);
  if (errorPerfil) {
    return { status: "error", message: "No se pudo guardar el perfil: " + errorPerfil.message };
  }

  const declaracion = await obtenerDeclaracionVigente(empresaId, eventoId);
  const cabeceras = await headers();

  const supabase = await createClient();
  const { data: inscripcionId, error } = await supabase.rpc("inscribir_manualmente", {
    p_categoria_id: d.categoriaId,
    p_corredor_id: corredorId,
    p_declaracion_id: declaracion.id,
    p_talla: d.talla || null,
    p_datos_adicionales: { origen: "mesa" },
    p_firma_imagen_url: null,
    p_ip: cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    p_dispositivo: cabeceras.get("user-agent"),
    p_tutor_nombre: d.tutorNombre || null,
    p_tutor_documento: d.tutorDocumento || null,
    p_precio: d.precio ? Number(d.precio) : null,
    p_cobrar_en_efectivo: d.cobrarEfectivo === "on",
  });

  if (error || !inscripcionId) {
    const mensaje = error?.message.includes("CUPO_AGOTADO")
      ? "Esa categoría ya no tiene cupo."
      : (error?.message ?? "No se pudo inscribir.").replace(/^.*?:\s*/, "");
    return { status: "error", message: mensaje };
  }

  // Ya no se sube ninguna firma dibujada. `inscribir_manualmente` deja
  // `aceptado_checkbox` en true y el expediente guarda fecha, IP, dispositivo y
  // versión del documento, que es lo que sostiene el consentimiento.

  await auditar({
    accion: "inscripcion.crear",
    entidad: "inscripciones",
    entidadId: inscripcionId,
    empresaId,
    datosNuevos: {
      origen: "mesa",
      correo: d.correo,
      categoria_id: d.categoriaId,
      cobrado_efectivo: d.cobrarEfectivo === "on",
    },
  });

  revalidatePath(`/panel/eventos/${eventoId}/inscritos`);
  revalidatePath(`/panel/eventos/${eventoId}`);
  redirect(`/panel/eventos/${eventoId}/inscritos?nuevo=${inscripcionId}`);
}
