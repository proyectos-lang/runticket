import type { Tono } from "@/lib/tonos";

/**
 * Umbrales de ocupación. **Fuente única de verdad de todo el panel**: la usan
 * el resumen, el inventario, las métricas y la lista de categorías, y antes
 * cada pantalla decidía su propio corte.
 *
 *   < 80 %   azul, informativo
 *   80–89 %  naranja: queda poco, conviene mirarlo
 *   90–99 %  ámbar: se está agotando
 *   100 %    rojo: agotado, y en inscripción ya no se puede elegir
 */
export type NivelOcupacion = "normal" | "alta" | "se_agota" | "agotada";

export function nivelDeOcupacion(porcentaje: number): NivelOcupacion {
  if (porcentaje >= 100) return "agotada";
  if (porcentaje >= 90) return "se_agota";
  if (porcentaje >= 80) return "alta";
  return "normal";
}

const RELLENO: Record<NivelOcupacion, string> = {
  normal: "var(--color-azul)",
  alta: "linear-gradient(90deg, var(--color-naranja), var(--color-naranja-suave))",
  se_agota: "var(--color-ambar)",
  agotada: "#ef4444",
};

const TINTA: Record<NivelOcupacion, string> = {
  normal: "text-atenuado",
  alta: "text-naranja-suave",
  se_agota: "text-ambar",
  agotada: "text-rojo",
};

export const ETIQUETA_NIVEL: Record<NivelOcupacion, string> = {
  normal: "Normal",
  alta: "Queda poco",
  se_agota: "Se agota",
  agotada: "Agotada",
};

/**
 * Barra de ocupación con su cifra.
 *
 * Sin tope (`total` nulo) no hay ocupación que medir: se dice «cupo abierto» en
 * vez de pintar una barra al 0 %, que se leería como «no se ha apuntado nadie».
 */
export function MedidorOcupacion({
  ocupado,
  total,
  etiqueta,
  grosor = 6,
  className = "",
}: {
  ocupado: number;
  total: number | null;
  etiqueta?: string;
  grosor?: number;
  className?: string;
}) {
  if (total === null || total <= 0) {
    return (
      <p className={`font-mono text-[0.65625rem] uppercase tracking-etiqueta text-mudo ${className}`}>
        Cupo abierto · {ocupado.toLocaleString("es-HN")} inscritos
      </p>
    );
  }

  const porcentaje = Math.min(100, Math.round((ocupado / total) * 100));
  const nivel = nivelDeOcupacion(porcentaje);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        {etiqueta && (
          <span className="font-mono text-[0.625rem] font-semibold uppercase tracking-etiqueta text-mudo">
            {etiqueta}
          </span>
        )}
        <span className="tabular font-mono text-[0.71875rem] font-semibold text-atenuado">
          {ocupado.toLocaleString("es-HN")} / {total.toLocaleString("es-HN")} ·{" "}
          <span className={`font-bold ${TINTA[nivel]}`}>{porcentaje} %</span>
        </span>
      </div>
      <div
        className="w-full overflow-hidden rounded-full bg-texto/7"
        style={{ height: grosor }}
        role="meter"
        aria-valuenow={porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={etiqueta ?? "Ocupación"}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${porcentaje}%`, background: RELLENO[nivel] }}
        />
      </div>
    </div>
  );
}

/** Tarjeta de cifra del panel. El borde de color solo lo lleva lo que exige acción. */
export function TarjetaMetricaPanel({
  label,
  valor,
  nota,
  tono = "neutro",
  className = "",
}: {
  label: string;
  valor: React.ReactNode;
  nota?: React.ReactNode;
  tono?: Tono;
  className?: string;
}) {
  // Solo ámbar y rojo llevan borde: son los que reclaman una acción hoy. Poner
  // borde a todas las tarjetas las igualaría y ninguna destacaría.
  const borde =
    tono === "aviso"
      ? "border-amber-500/38"
      : tono === "error"
        ? "border-red-500/40"
        : "border-linea";
  const tinta =
    tono === "aviso"
      ? "text-ambar"
      : tono === "error"
        ? "text-rojo"
        : tono === "info"
          ? "text-cian"
          : "text-texto";

  return (
    <div
      className={`flex flex-col gap-1 rounded-lg border bg-superficie-2 px-4 py-3.5 ${borde} ${className}`}
    >
      <span className="font-mono text-[0.59375rem] font-semibold uppercase tracking-etiqueta text-mudo">
        {label}
      </span>
      <span className={`tabular text-[1.75rem] font-extrabold tracking-display-fuerte ${tinta}`}>
        {valor}
      </span>
      {nota && (
        <span
          className={`tabular font-mono text-[0.625rem] ${tono === "aviso" ? "text-ambar" : "text-mudo"}`}
        >
          {nota}
        </span>
      )}
    </div>
  );
}
