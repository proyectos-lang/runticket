import { createClient } from "@/lib/supabase/server";
import { EscanerCheckin, type ModoEscaner } from "@/app/panel/eventos/[id]/checkin/EscanerCheckin";

/**
 * Escáner de entrega de kits. Lo comparten `/panel/checkin` y
 * `/panel/eventos/[id]/checkin`.
 *
 * El contenedor es estrecho a propósito: esta pantalla se usa de pie, en la mesa
 * del evento y con una sola mano.
 */
export async function ModuloCheckin({
  eventoId,
  codigoInicial,
  modo = "kit",
}: {
  eventoId: string;
  codigoInicial?: string;
  modo?: ModoEscaner;
}) {
  const supabase = await createClient();
  const columna = modo === "kit" ? "kit_entregado" : "asistencia_confirmada";

  const [{ count: activas }, { count: registrados }] = await Promise.all([
    supabase
      .from("inscripciones")
      .select("*", { count: "exact", head: true })
      .eq("evento_id", eventoId)
      .eq("estado", "activa"),
    supabase
      .from("inscripciones")
      .select("*", { count: "exact", head: true })
      .eq("evento_id", eventoId)
      .eq("estado", "activa")
      .eq(columna, true),
  ]);

  const total = activas ?? 0;
  const hechos = registrados ?? 0;
  const porcentaje = total ? Math.round((hechos / total) * 100) : 0;

  return (
    // Sin ancho máximo: esta pantalla se usa en una tablet apoyada en la mesa,
    // y el dorsal y la talla tienen que leerse desde un metro. Encajonarla en
    // una columna estrecha es justo lo que impide eso.
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-linea bg-superficie px-5 py-4">
        <span className="font-mono text-[0.625rem] font-semibold uppercase tracking-etiqueta text-mudo">
          {modo === "kit" ? "Kits entregados" : "Corredores presentes"}
        </span>
        <span className="tabular ml-auto font-mono text-sm font-bold text-texto">
          {hechos} / {total} · <span className={modo === "kit" ? "text-naranja-suave" : "text-cian"}>{porcentaje} %</span>
        </span>
        <div className="w-full sm:w-35">
          <div
            className="h-1.75 w-full overflow-hidden rounded-full bg-texto/7"
            role="meter"
            aria-valuenow={hechos}
            aria-valuemax={total}
            aria-label={modo === "kit" ? "Progreso de entrega de kits" : "Progreso de asistencia"}
          >
            <div
              className="h-full rounded-full transition-[width]"
              style={{
                width: `${porcentaje}%`,
                // Naranja en kits (hay una cola esperando) y azul en asistencia,
                // que es un conteo sin urgencia.
                background:
                  modo === "kit"
                    ? "linear-gradient(90deg, var(--color-naranja), var(--color-naranja-suave))"
                    : "var(--color-azul)",
              }}
            />
          </div>
        </div>
      </div>

      <EscanerCheckin eventoId={eventoId} codigoInicial={codigoInicial} modo={modo} />
    </div>
  );
}
