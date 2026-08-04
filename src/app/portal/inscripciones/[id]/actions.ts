"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type PagoState = {
  status: "idle" | "error" | "enviado";
  message?: string;
};

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB: fotos de comprobante desde el celular

const comprobanteSchema = z.object({
  referencia: z.string().trim().max(60).optional().or(z.literal("")),
});

/** Deja constancia de que el corredor va a pagar coordinando por WhatsApp. */
export async function marcarPagoPorWhatsApp(inscripcionId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_intento_pago", {
    p_inscripcion_id: inscripcionId,
    p_metodo: "whatsapp",
  });
  if (error) throw new Error("No se pudo registrar el pago: " + error.message);
  revalidatePath(`/portal/inscripciones/${inscripcionId}`);
}

export async function subirComprobante(
  inscripcionId: string,
  _prevState: PagoState,
  formData: FormData
): Promise<PagoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/portal/inscripciones/${inscripcionId}`);

  const parsed = comprobanteSchema.safeParse({ referencia: formData.get("referencia") });
  if (!parsed.success) {
    return { status: "error", message: "Revisa la referencia introducida." };
  }

  const archivo = formData.get("comprobante");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { status: "error", message: "Selecciona la imagen o el PDF de tu comprobante." };
  }
  if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
    return { status: "error", message: "El comprobante debe ser una imagen (JPG, PNG, WebP) o un PDF." };
  }
  if (archivo.size > TAMANO_MAXIMO) {
    return { status: "error", message: "El archivo supera los 5 MB. Sube una foto más ligera." };
  }

  // Se relee la inscripción con el cliente del usuario: la RLS garantiza que solo
  // pueda subir comprobantes de las suyas.
  const { data: inscripcion } = await supabase
    .from("inscripciones")
    .select("id, empresa_id, corredor_id")
    .eq("id", inscripcionId)
    .maybeSingle();
  if (!inscripcion || inscripcion.corredor_id !== user.id) {
    return { status: "error", message: "No encontramos esa inscripción." };
  }

  const extension = archivo.type === "application/pdf" ? "pdf" : archivo.type.split("/")[1];
  // Nombre único por intento, no un `upsert`: el bucket no tiene política de
  // UPDATE (a propósito), y si el organizador rechaza un comprobante conviene
  // conservarlo como evidencia en vez de sobrescribirlo. `pagos.comprobante_url`
  // siempre apunta al vigente.
  const ruta = `${inscripcion.empresa_id}/${inscripcionId}/comprobante-${Date.now()}.${extension}`;

  // El bucket `comprobantes` es privado y su política se basa en la ruta
  // {empresa_id}/{inscripcion_id}/...; se sube con el cliente del usuario para
  // que esa política se aplique de verdad.
  const { error: errorSubida } = await supabase.storage
    .from("comprobantes")
    .upload(ruta, archivo, { contentType: archivo.type });
  if (errorSubida) {
    return { status: "error", message: "No se pudo subir el comprobante: " + errorSubida.message };
  }

  const { error } = await supabase.rpc("registrar_intento_pago", {
    p_inscripcion_id: inscripcionId,
    p_metodo: "comprobante_transferencia",
    p_comprobante_url: ruta,
    p_referencia: parsed.data.referencia || null,
  });
  if (error) {
    return { status: "error", message: "No se pudo registrar el comprobante: " + error.message };
  }

  revalidatePath(`/portal/inscripciones/${inscripcionId}`);
  return { status: "enviado" };
}

export type TallaState = { status: "idle" | "error" | "guardado"; message?: string };

/**
 * Cambia la talla de la inscripción. La RPC mueve el inventario de forma
 * atómica y valida propiedad, estado y que el kit no se haya entregado.
 */
export async function cambiarTalla(
  inscripcionId: string,
  _prevState: TallaState,
  formData: FormData
): Promise<TallaState> {
  const talla = formData.get("talla");
  const supabase = await createClient();

  const { error } = await supabase.rpc("cambiar_talla_inscripcion", {
    p_inscripcion_id: inscripcionId,
    p_talla: typeof talla === "string" && talla ? talla : null,
  });
  if (error) {
    return { status: "error", message: error.message.replace(/^.*?:\s*/, "") };
  }

  revalidatePath(`/portal/inscripciones/${inscripcionId}`);
  return { status: "guardado" };
}

// Aquí vivía `urlFirmadaComprobante(ruta)`. Se ha eliminado: no la invocaba
// nadie y era la única acción del proyecto sin comprobación alguna. Aceptaba una
// ruta arbitraria del cliente y devolvía una URL firmada del bucket privado
// `comprobantes` con el cliente administrador, es decir, saltándose la RLS. Una
// acción de servidor exportada es invocable por su identificador aunque ninguna
// pantalla la use, así que era un lector de comprobantes ajenos a la espera.
//
// Si vuelve a hacer falta, tiene que resolver la ruta a partir del id de la
// inscripción y comprobar antes que el corredor sea su dueño.
