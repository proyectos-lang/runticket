"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dentroDelLimite, MENSAJE_LIMITE } from "@/lib/seguridad";
import type { PagoState } from "@/app/portal/inscripciones/[id]/actions";

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB: fotos de comprobante desde el celular

const comprobanteSchema = z.object({
  referencia: z.string().trim().max(60).optional().or(z.literal("")),
});

/** El titular declara que coordinará por WhatsApp el pago de toda la familia. */
export async function marcarPagoGrupoPorWhatsApp(grupoId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_intento_pago_grupo", {
    p_grupo_id: grupoId,
    p_metodo: "whatsapp",
  });
  if (error) throw new Error("No se pudo registrar el pago: " + error.message);
  revalidatePath(`/portal/grupos/${grupoId}`);
}

/**
 * Sube **un** comprobante por toda la familia.
 *
 * El importe no viaja desde aquí: lo suma `registrar_intento_pago_grupo` en la
 * base a partir de las inscripciones vivas del grupo. Si lo fijara el navegador,
 * el corredor decidiría cuánto debe.
 */
export async function subirComprobanteGrupo(
  grupoId: string,
  _prevState: PagoState,
  formData: FormData
): Promise<PagoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/portal/grupos/${grupoId}`);

  if (!(await dentroDelLimite("subidaComprobante"))) {
    return { status: "error", message: MENSAJE_LIMITE };
  }

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

  // Se relee el grupo con el cliente del usuario: la RLS garantiza que solo
  // pueda subir comprobantes de los grupos que él paga.
  const { data: grupo } = await supabase
    .from("grupos_inscripcion")
    .select("id, empresa_id, pagador_id")
    .eq("id", grupoId)
    .maybeSingle();
  if (!grupo || grupo.pagador_id !== user.id) {
    return { status: "error", message: "No encontramos ese grupo." };
  }

  const extension = archivo.type === "application/pdf" ? "pdf" : archivo.type.split("/")[1];
  // Nombre único por intento, no un `upsert`: si el organizador rechaza un
  // comprobante conviene conservarlo como evidencia. `pagos.comprobante_url`
  // siempre apunta al vigente.
  const ruta = `${grupo.empresa_id}/${grupoId}/comprobante-${Date.now()}.${extension}`;

  // Con el cliente del usuario para que la política del bucket se aplique de
  // verdad; la rama de grupo la abrió la migración 0028.
  const { error: errorSubida } = await supabase.storage
    .from("comprobantes")
    .upload(ruta, archivo, { contentType: archivo.type });
  if (errorSubida) {
    return { status: "error", message: "No se pudo subir el comprobante: " + errorSubida.message };
  }

  const { error } = await supabase.rpc("registrar_intento_pago_grupo", {
    p_grupo_id: grupoId,
    p_metodo: "comprobante_transferencia",
    p_comprobante_url: ruta,
    p_referencia: parsed.data.referencia || null,
  });
  if (error) {
    return { status: "error", message: "No se pudo registrar el comprobante: " + error.message };
  }

  revalidatePath(`/portal/grupos/${grupoId}`);
  return { status: "enviado" };
}
