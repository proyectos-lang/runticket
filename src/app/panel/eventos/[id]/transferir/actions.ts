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

export type TransferenciaState = {
  status: "idle" | "error";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

const esquema = z.object({
  inscripcionId: z.uuid("Selecciona la inscripción a transferir."),
  correo: z.email("Introduce el correo de quien la recibe."),
  nombres: z.string().trim().min(2, "Introduce los nombres.").max(80),
  apellidos: z.string().trim().min(2, "Introduce los apellidos.").max(80),
  fechaNacimiento: z.string().min(1, "Hace falta para validar la categoría."),
  sexo: z.enum(["masculino", "femenino", "otro"], { message: "Selecciona el sexo." }),
  telefono: opcional(z.string().trim().max(30)),
  contactoEmergenciaNombre: z.string().trim().min(2, "Introduce el contacto de emergencia.").max(80),
  contactoEmergenciaTelefono: z.string().trim().min(6, "Introduce el teléfono de emergencia.").max(30),
  motivo: opcional(z.string().trim().max(200)),
  // La declaración del titular original no cubre a nadie más, así que quien
  // recibe la inscripción tiene que aceptarla por su cuenta.
  acepto: z.literal("on", {
    message: "Falta que quien recibe la inscripción acepte la declaración.",
  }),
});

/**
 * Traspasa una inscripción a otra persona. Exige la firma del nuevo titular:
 * la declaración de responsabilidad la firmó quien se inscribió originalmente y
 * no cubre a nadie más, así que sin firma nueva la persona correría sin deslinde.
 */
export async function transferirInscripcion(
  eventoId: string,
  _prevState: TransferenciaState,
  formData: FormData
): Promise<TransferenciaState> {
  const { empresaId } = await requireAdminDeEvento(eventoId);

  const parsed = esquema.safeParse({
    inscripcionId: formData.get("inscripcionId"),
    correo: formData.get("correo"),
    nombres: formData.get("nombres"),
    apellidos: formData.get("apellidos"),
    fechaNacimiento: formData.get("fechaNacimiento"),
    sexo: formData.get("sexo"),
    telefono: formData.get("telefono"),
    contactoEmergenciaNombre: formData.get("contactoEmergenciaNombre"),
    contactoEmergenciaTelefono: formData.get("contactoEmergenciaTelefono"),
    motivo: formData.get("motivo"),
    acepto: formData.get("acepto"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const admin = createAdminClient();

  // Si la persona ya tiene cuenta se reutiliza; si no, se le crea, porque
  // después tiene que poder ver su dorsal y su certificado.
  const { data: existente } = await admin
    .from("perfiles")
    .select("id")
    .ilike("correo", d.correo)
    .maybeSingle();

  let nuevoCorredorId = existente?.id;
  if (!nuevoCorredorId) {
    const { data: creado, error } = await admin.auth.admin.createUser({
      email: d.correo,
      email_confirm: true,
      user_metadata: { nombres: d.nombres, apellidos: d.apellidos },
    });
    if (error || !creado.user) {
      return { status: "error", message: "No se pudo crear la cuenta: " + (error?.message ?? "") };
    }
    nuevoCorredorId = creado.user.id;
  }

  const { error: errorPerfil } = await admin
    .from("perfiles")
    .update({
      nombres: d.nombres,
      apellidos: d.apellidos,
      telefono: d.telefono || null,
      fecha_nacimiento: d.fechaNacimiento,
      sexo: d.sexo,
      contacto_emergencia_nombre: d.contactoEmergenciaNombre,
      contacto_emergencia_telefono: d.contactoEmergenciaTelefono,
    })
    .eq("id", nuevoCorredorId);
  if (errorPerfil) {
    return { status: "error", message: "No se pudo guardar el perfil: " + errorPerfil.message };
  }

  const declaracion = await obtenerDeclaracionVigente(empresaId, eventoId);
  const cabeceras = await headers();

  const supabase = await createClient();
  const { data: nuevaId, error } = await supabase.rpc("transferir_inscripcion_firmada", {
    p_inscripcion_id: d.inscripcionId,
    p_nuevo_corredor_id: nuevoCorredorId,
    p_declaracion_id: declaracion.id,
    p_firma_imagen_url: null,
    p_ip: cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    p_dispositivo: cabeceras.get("user-agent"),
    p_motivo: d.motivo || null,
  });

  if (error || !nuevaId) {
    return { status: "error", message: (error?.message ?? "No se pudo transferir.").replace(/^.*?:\s*/, "") };
  }

  // Ya no se sube ninguna firma dibujada: la aceptación queda con su fecha, su
  // IP, su dispositivo y la versión del documento, que es lo que prueba algo.

  await auditar({
    accion: "inscripcion.transferir",
    entidad: "inscripciones",
    entidadId: nuevaId,
    empresaId,
    datosAnteriores: { inscripcion_original: d.inscripcionId },
    datosNuevos: { nuevo_corredor: d.correo, motivo: d.motivo || null },
  });

  revalidatePath(`/panel/eventos/${eventoId}/inscritos`);
  redirect(`/panel/eventos/${eventoId}/inscritos?transferida=${nuevaId}`);
}
