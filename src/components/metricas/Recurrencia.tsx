import { EtiquetaMono } from "@/components/ui/Datos";

export type Recurrencia = {
  /**
   * El universo sobre el que se reparten los otros dos. En métricas son
   * corredores distintos; en el padrón, participaciones. Quien llama dice cuál
   * con `etiquetaTotal`, porque una cifra sin unidad se lee como la que
   * convenga.
   */
  total: number;
  recurrentes: number;
  nuevos: number;
};

/**
 * Corredores que repiten frente a los que vienen por primera vez (6.12).
 *
 * **Es siempre respecto a esta empresa organizadora, nunca a la plataforma.**
 * Que la empresa A pudiera ver que un corredor suyo también corre con la B sería
 * una fuga entre inquilinos, y el aislamiento multiempresa es el requisito más
 * crítico de toda la especificación. El subtítulo lo dice en pantalla para que
 * nadie lea la cifra como «carreras que ha corrido en su vida».
 *
 * Se pinta como una sola barra de dos tramos y no como dos barras: son partes de
 * un mismo total, y dos barras sueltas invitan a compararlas con el eje en vez de
 * entre sí. Azul y `--viz-serie-2` porque el cian, a la luminosidad del sistema,
 * domina al azul y el tramo pequeño se leería como el grande.
 */
export function BloqueRecurrencia({
  datos,
  titulo = "Corredores nuevos y recurrentes",
  etiquetaTotal = "Corredores distintos",
  nota,
}: {
  datos: Recurrencia;
  titulo?: string;
  etiquetaTotal?: string;
  nota?: string;
}) {
  const { total: corredores, recurrentes, nuevos } = datos;

  if (corredores === 0) {
    return (
      <section className="rounded-2xl border border-linea bg-superficie p-6">
        <h2 className="mb-4 text-lg font-semibold text-texto">{titulo}</h2>
        <p className="py-10 text-center text-sm text-atenuado">Todavía no hay datos suficientes.</p>
      </section>
    );
  }

  const pct = (n: number) => Math.round((n / corredores) * 100);
  const pctRecurrentes = pct(recurrentes);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-linea bg-superficie p-6">
      <div>
        <h2 className="text-lg font-semibold text-texto">{titulo}</h2>
        <p className="mt-1 text-sm text-atenuado">
          {nota ??
            "Recurrente es quien ya corrió antes una carrera tuya. No incluye lo que haya corrido con otros organizadores."}
        </p>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
        <div>
          <EtiquetaMono>Recurrentes</EtiquetaMono>
          <p className="tabular text-3xl font-semibold tracking-display text-texto">
            {recurrentes.toLocaleString("es-HN")}
            <span className="ml-2 font-mono text-base text-mudo">{pctRecurrentes}%</span>
          </p>
        </div>
        <div>
          <EtiquetaMono>Nuevos</EtiquetaMono>
          <p className="tabular text-3xl font-semibold tracking-display text-texto">
            {nuevos.toLocaleString("es-HN")}
            <span className="ml-2 font-mono text-base text-mudo">{100 - pctRecurrentes}%</span>
          </p>
        </div>
        <div>
          <EtiquetaMono>{etiquetaTotal}</EtiquetaMono>
          <p className="tabular text-3xl font-semibold tracking-display text-atenuado">
            {corredores.toLocaleString("es-HN")}
          </p>
        </div>
      </div>

      <div
        className="viz flex h-3 w-full overflow-hidden rounded-full"
        style={{ background: "var(--viz-track)" }}
        role="img"
        aria-label={`${recurrentes} corredores recurrentes y ${nuevos} nuevos, de ${corredores} en total`}
      >
        <div style={{ width: `${pctRecurrentes}%`, background: "var(--viz-serie)" }} />
        <div style={{ width: `${100 - pctRecurrentes}%`, background: "var(--viz-serie-2)" }} />
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-atenuado">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-full"
            style={{ background: "var(--viz-serie)" }}
          />
          Ya habían corrido contigo
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-full"
            style={{ background: "var(--viz-serie-2)" }}
          />
          Primera vez contigo
        </span>
      </div>
    </section>
  );
}
