import { EtiquetaMono } from "@/components/ui/Datos";
import { formatFechaCorta } from "@/lib/format";
import type { NpsEvento } from "@/lib/supabase/database.types";

/**
 * Resultado de la encuesta post-evento (9.5).
 *
 * El NPS es el porcentaje de promotores menos el de detractores, no la media de
 * las notas; van los dos porque responden preguntas distintas y quien lee suele
 * conocer solo uno de los dos.
 *
 * Verde/ámbar/rojo aquí sí: promotor, pasivo y detractor son **estados**, que es
 * justo el uso que el sistema reserva a esos tres colores. Lo que no llevan es
 * naranja, que sigue siendo de la acción.
 *
 * La tasa de respuesta se enseña siempre y en primer plano. Un NPS de +80 sobre
 * cuatro respuestas de mil inscritos no dice nada, y sin el denominador a la
 * vista se presenta solo como una nota excelente.
 */
export function BloqueNps({ datos }: { datos: NpsEvento }) {
  const { respuestas, invitados, promotores, pasivos, detractores, nps, promedio } = datos;

  if (respuestas === 0) {
    return (
      <section className="flex flex-col gap-2 rounded-2xl border border-linea bg-superficie p-6">
        <h2 className="text-lg font-semibold text-texto">Satisfacción de los corredores</h2>
        <p className="text-sm text-atenuado">
          Todavía sin respuestas. La encuesta se pide sola en el portal del corredor en cuanto das
          la carrera por finalizada, y otra vez junto a su resultado.
        </p>
      </section>
    );
  }

  const tasa = invitados > 0 ? Math.round((respuestas / invitados) * 100) : 0;
  const pct = (n: number) => (n / respuestas) * 100;

  // Convención del sector: 50 o más es muy bueno, 0 o más es aceptable, por
  // debajo de 0 hay más gente que desaconseja la carrera que gente que la
  // recomienda.
  const tonoNps =
    nps === null ? "text-texto" : nps >= 50 ? "text-emerald-300" : nps >= 0 ? "text-texto" : "text-red-300";

  const tramos = [
    { etiqueta: "Promotores", n: promotores, color: "#34d399", ayuda: "9-10" },
    { etiqueta: "Pasivos", n: pasivos, color: "#fbbf24", ayuda: "7-8" },
    { etiqueta: "Detractores", n: detractores, color: "#f87171", ayuda: "0-6" },
  ];

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-linea bg-superficie p-6">
      <div>
        <h2 className="text-lg font-semibold text-texto">Satisfacción de los corredores</h2>
        <p className="mt-1 text-sm text-atenuado">
          {respuestas.toLocaleString("es-HN")} de {invitados.toLocaleString("es-HN")} inscritos han
          respondido ({tasa}%).
        </p>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
        <div>
          <EtiquetaMono>NPS</EtiquetaMono>
          <p className={`tabular text-3xl font-semibold tracking-display ${tonoNps}`}>
            {nps !== null && nps > 0 ? "+" : ""}
            {nps ?? "—"}
          </p>
          <p className="text-xs text-mudo">de -100 a +100</p>
        </div>
        <div>
          <EtiquetaMono>Nota media</EtiquetaMono>
          <p className="tabular text-3xl font-semibold tracking-display text-texto">
            {promedio ?? "—"}
            <span className="ml-1 font-mono text-base text-mudo">/10</span>
          </p>
        </div>
      </div>

      <div
        className="viz flex h-3 w-full overflow-hidden rounded-full"
        style={{ background: "var(--viz-track)" }}
        role="img"
        aria-label={`${promotores} promotores, ${pasivos} pasivos y ${detractores} detractores`}
      >
        {tramos.map((t) => (
          <div key={t.etiqueta} style={{ width: `${pct(t.n)}%`, background: t.color }} />
        ))}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-atenuado">
        {tramos.map((t) => (
          <span key={t.etiqueta} className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block size-2.5 rounded-full"
              style={{ background: t.color }}
            />
            {t.etiqueta} <span className="text-mudo">({t.ayuda})</span>
            <span className="tabular font-mono text-texto">{t.n}</span>
          </span>
        ))}
      </div>

      {datos.comentarios.length > 0 && (
        <details className="border-t border-linea pt-4">
          <summary className="cursor-pointer font-mono text-[0.6875rem] uppercase tracking-etiqueta text-mudo hover:text-texto">
            Ver los {datos.comentarios.length} comentarios
          </summary>
          <ul className="mt-3 flex flex-col gap-3">
            {datos.comentarios.map((c, i) => (
              <li
                key={`${c.respondido_en}-${i}`}
                className="flex gap-3 rounded-xl border border-linea bg-superficie-2 px-4 py-3"
              >
                <span
                  className={`tabular shrink-0 font-mono text-sm font-bold ${
                    c.puntaje >= 9
                      ? "text-emerald-300"
                      : c.puntaje >= 7
                        ? "text-amber-300"
                        : "text-red-300"
                  }`}
                >
                  {c.puntaje}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-texto">{c.comentario}</p>
                  <p className="mt-0.5 font-mono text-[0.625rem] uppercase tracking-etiqueta text-mudo">
                    {formatFechaCorta(c.respondido_en)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {/* Se dice explícitamente: sin esto, un organizador puede intentar
              cruzar el comentario con el padrón para saber quién lo escribió. */}
          <p className="mt-3 text-xs text-mudo">
            Los comentarios llegan sin identificar a quien los escribió. Es lo que hace que la gente
            conteste con franqueza.
          </p>
        </details>
      )}
    </section>
  );
}
