import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { DatosAcompanante } from "@/lib/validacion/acompanantes";
import { DOMINIO_INTERNO } from "./cuenta";

/** Los datos que la inscripción necesita de una persona. */
export function perfilDeAcompanante(d: DatosAcompanante) {
  return {
    nombres: d.nombres,
    apellidos: d.apellidos,
    fecha_nacimiento: d.fechaNacimiento,
    sexo: d.sexo,
    documento_identidad: d.documentoIdentidad || null,
    talla_predeterminada: d.tallaPredeterminada || null,
    contacto_emergencia_nombre: d.contactoEmergenciaNombre || null,
    contacto_emergencia_telefono: d.contactoEmergenciaTelefono || null,
  };
}

export type ResultadoAlta =
  | { ok: true; relacionId: string; usuarioId: string }
  | { ok: false; message: string };

/**
 * Da de alta a un acompañante y lo asocia a su titular.
 *
 * Crea por detrás una cuenta que **nunca recibe un correo ni puede iniciar
 * sesión**: `email_confirm: true` y sin contraseña, igual que hace el panel al
 * inscribir a alguien en la mesa. Hace falta porque `inscripciones.corredor_id`
 * exige un usuario; a cambio, el acompañante tiene perfil y todo lo demás
 * —categoría por edad, dorsal, resultados, certificado— funciona sin excepciones.
 *
 * Sin correo se genera una dirección interna que nadie usa jamás. Con correo, esa
 * persona puede reclamar su cuenta más adelante desde «recuperar contraseña».
 *
 * Está aquí y no en la acción de una pantalla porque lo llaman dos: la lista del
 * portal y el propio formulario de inscripción, que deja añadir a alguien sin
 * salir de él. Con dos copias, arreglar un fallo en una dejaría la otra rota.
 */
export async function altaDeAcompanante(
  titularId: string,
  d: DatosAcompanante
): Promise<ResultadoAlta> {
  const admin = createAdminClient();
  let usuarioId: string | undefined;

  if (d.correo) {
    // Si ya hay cuenta con ese correo se reutiliza, en vez de fallar: es lo que
    // pasa cuando alguien inscribe a su pareja, que quizá ya se registró sola.
    const { data: existente } = await admin
      .from("perfiles")
      .select("id")
      .ilike("correo", d.correo)
      .maybeSingle();
    usuarioId = existente?.id;

    if (usuarioId === titularId) {
      return { ok: false, message: "Ese es tu propio correo." };
    }
  }

  /**
   * El alta son tres pasos que no comparten transacción: crear la cuenta,
   * rellenar su perfil y asociarla. Si el último falla y no se deshace el
   * primero, queda una cuenta suelta que nadie gestiona y que además reserva su
   * correo para siempre; cada reintento dejaría otra. Por eso se recuerda si la
   * cuenta la creamos aquí, para poder borrarla.
   */
  let creadaAqui = false;

  if (!usuarioId) {
    const { data: creado, error } = await admin.auth.admin.createUser({
      // Sin correo real se usa una dirección interna no enrutable: `createUser`
      // exige una y este acompañante no va a recibir nada nunca.
      email: d.correo || `acompanante-${crypto.randomUUID()}${DOMINIO_INTERNO}`,
      email_confirm: true,
      user_metadata: { nombres: d.nombres, apellidos: d.apellidos, gestionado_por: titularId },
    });
    if (error || !creado.user) {
      return {
        ok: false,
        message: "No se pudo crear el acompañante: " + (error?.message ?? "error desconocido"),
      };
    }
    usuarioId = creado.user.id;
    creadaAqui = true;
  }

  const deshacer = async (message: string): Promise<ResultadoAlta> => {
    if (creadaAqui && usuarioId) await admin.auth.admin.deleteUser(usuarioId);
    return { ok: false, message };
  };

  const { error: errorPerfil } = await admin
    .from("perfiles")
    .update(perfilDeAcompanante(d))
    .eq("id", usuarioId);
  if (errorPerfil) {
    return deshacer("No se pudieron guardar sus datos: " + errorPerfil.message);
  }

  const { data: relacion, error: errorRelacion } = await admin
    .from("acompanantes")
    .upsert(
      { titular_id: titularId, usuario_id: usuarioId, parentesco: d.parentesco },
      { onConflict: "titular_id,usuario_id" }
    )
    .select("id")
    .single();

  if (errorRelacion || !relacion) {
    // PGRST205: la tabla no existe todavía. El mensaje crudo de PostgREST no le
    // dice nada a quien usa el portal, así que se traduce a la causa real.
    const faltaMigracion = /schema cache|acompanantes/i.test(errorRelacion?.message ?? "");
    return deshacer(
      faltaMigracion
        ? "Esta función todavía no está habilitada en la base de datos. Falta ejecutar la migración 0026."
        : "No se pudo asociar: " + (errorRelacion?.message ?? "error desconocido")
    );
  }

  return { ok: true, relacionId: relacion.id, usuarioId };
}
