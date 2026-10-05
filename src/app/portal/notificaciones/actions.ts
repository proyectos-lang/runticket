"use server";

import { mensajeDe, redirigirConAviso } from "@/lib/avisos";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TIPOS_DE_PANEL_SQL } from "@/lib/notificaciones";

/** La RLS solo deja al dueño marcar las suyas. */
export async function marcarLeida(notificacionId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notificaciones")
    .update({ leido: true, leido_en: new Date().toISOString() })
    .eq("id", notificacionId);
  if (error) redirigirConAviso("/portal/notificaciones", "No se pudo marcar como leída: " + mensajeDe(error));

  revalidatePath("/portal/notificaciones");
}

export async function marcarTodasLeidas() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Solo las de corredor: si esta persona además administra una empresa, un
  // botón del portal no debe darle por vistos los avisos de su panel.
  await supabase
    .from("notificaciones")
    .update({ leido: true, leido_en: new Date().toISOString() })
    .eq("usuario_id", user.id)
    .eq("leido", false)
    .not("tipo", "in", TIPOS_DE_PANEL_SQL);

  revalidatePath("/portal/notificaciones");
}
