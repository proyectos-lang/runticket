import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { navPortal } from "@/components/shell/navegacion";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login?next=/portal");

  const supabase = await createClient();
  // Dos contadores que el menú necesita en todas las pantallas del portal. Se
  // piden con `head` y `count`: no hace falta traer las filas, solo cuántas hay.
  const [{ count: inscripciones }, { count: sinLeer }] = await Promise.all([
    supabase
      .from("inscripciones")
      .select("id", { count: "exact", head: true })
      .eq("corredor_id", usuario.id)
      .eq("estado", "activa"),
    supabase
      .from("notificaciones")
      .select("id", { count: "exact", head: true })
      .eq("leido", false),
  ]);

  return (
    <AppShell
      secciones={navPortal({
        inscripciones: inscripciones ?? 0,
        sinLeer: sinLeer ?? 0,
      })}
      titulo="RunTicket"
      subtitulo="Portal del corredor"
      correo={usuario.email ?? undefined}
    >
      {children}
    </AppShell>
  );
}
