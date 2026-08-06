"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TIPOS_DE_PANEL } from "@/lib/notificaciones";

/** La RLS solo deja al dueño marcar las suyas. */
export async function marcarLeida(notificacionId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notificaciones")
    .update({ leido: true, leido_en: new Date().toISOString() })
    .eq("id", notificacionId);
  if (error) throw new Error("No se pudo marcar como leída: " + error.message);

  revalidatePath("/panel/notificaciones");
}

export async function marcarTodasLeidas() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Solo las del panel: si esta persona además corre, sus avisos de corredor son
  // suyos y no debe marcárselos como leídos un botón del panel.
  await supabase
    .from("notificaciones")
    .update({ leido: true, leido_en: new Date().toISOString() })
    .eq("usuario_id", user.id)
    .eq("leido", false)
    .in("tipo", [...TIPOS_DE_PANEL]);

  revalidatePath("/panel/notificaciones");
}
