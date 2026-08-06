import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatFechaHora } from "@/lib/format";
import { TIPOS_DE_PANEL } from "@/lib/notificaciones";
import { EtiquetaMono } from "@/components/ui/Datos";
import { marcarLeida, marcarTodasLeidas } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotificacionesPanelPage() {
  const supabase = await createClient();

  // La RLS ya limita las filas al usuario en sesión; el filtro por tipo separa
  // lo que le llega como organizador de lo que le llega como corredor.
  const { data: notificaciones } = await supabase
    .from("notificaciones")
    .select("id, tipo, titulo, mensaje, enlace, leido, created_at")
    .in("tipo", [...TIPOS_DE_PANEL])
    .order("created_at", { ascending: false })
    .limit(50);

  const sinLeer = (notificaciones ?? []).filter((n) => !n.leido).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-texto">Avisos</h1>
          <p className="text-sm text-atenuado">
            {sinLeer > 0 ? `${sinLeer} sin leer` : "Todo al día"}
          </p>
        </div>
        {sinLeer > 0 && (
          <form action={marcarTodasLeidas}>
            <button className="rounded-full border px-4 py-2 text-sm font-medium border-linea-fuerte text-atenuado hover:bg-superficie-2">
              Marcar todas como leídas
            </button>
          </form>
        )}
      </div>

      {notificaciones?.length ? (
        <div className="flex flex-col gap-3">
          {notificaciones.map((n) => (
            <article
              key={n.id}
              className={`flex flex-col gap-2 rounded-xl border bg-superficie px-4.5 py-4 ${
                n.leido ? "border-linea opacity-72" : "border-linea border-l-2 border-l-naranja"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-medium text-texto">{n.titulo}</h2>
                <span className="whitespace-nowrap text-xs text-atenuado">
                  {formatFechaHora(n.created_at)}
                </span>
              </div>
              <p className="text-sm text-atenuado">{n.mensaje}</p>
              <div className="flex flex-wrap items-center gap-4 pt-1 text-sm">
                {n.enlace && (
                  <Link
                    href={n.enlace}
                    className="font-medium underline-offset-2 hover:underline text-emerald-400"
                  >
                    Ver inscritos
                  </Link>
                )}
                {!n.leido && (
                  <form action={marcarLeida.bind(null, n.id)}>
                    <button className="underline-offset-2 hover:underline text-atenuado">
                      Marcar como leída
                    </button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center border-linea-fuerte">
          <EtiquetaMono>Sin avisos</EtiquetaMono>
          <p className="max-w-md text-sm text-atenuado">
            Aquí aparece cada inscripción nueva en cuanto ocurre, con quién se inscribió y cuánto
            queda por cobrar. Una familia que se inscribe junta genera un solo aviso.
          </p>
        </div>
      )}
    </div>
  );
}
