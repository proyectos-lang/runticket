"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";

export type Punto = { etiqueta: string; valor: number };

const EJE = { fill: "var(--viz-muted)", fontSize: 11 };

/** Tooltip con los tokens de texto del sistema, no con el color de la serie. */
function estiloTooltip() {
  return {
    contentStyle: {
      background: "var(--viz-tooltip-bg)",
      border: "1px solid var(--viz-grid)",
      borderRadius: "0.75rem",
      fontSize: "0.8125rem",
      color: "var(--viz-tooltip-ink)",
    },
    labelStyle: { color: "var(--viz-tooltip-ink)", fontWeight: 600 },
    itemStyle: { color: "var(--viz-tooltip-ink)" },
    cursor: { fill: "var(--viz-grid)", fillOpacity: 0.35 },
  };
}

/** Barras verticales para escalas ordenadas y cortas (edad, talla, experiencia). */
export function BarrasVerticales({ datos, unidad = "corredores" }: { datos: Punto[]; unidad?: string }) {
  return (
    <div className="viz h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 4, left: -20 }}>
          <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
          <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={{ stroke: "var(--viz-axis)" }} />
          <YAxis tick={EJE} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip {...estiloTooltip()} formatter={(v) => [`${v} ${unidad}`, ""]} />
          <Bar dataKey="valor" fill="var(--viz-serie)" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barras horizontales cuando las etiquetas son largas (ciudad, origen). */
export function BarrasHorizontales({ datos, unidad = "corredores" }: { datos: Punto[]; unidad?: string }) {
  return (
    <div className="viz w-full" style={{ height: Math.max(140, datos.length * 34 + 24) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
          <XAxis type="number" tick={EJE} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="etiqueta"
            tick={EJE}
            tickLine={false}
            axisLine={{ stroke: "var(--viz-axis)" }}
            width={130}
          />
          <Tooltip {...estiloTooltip()} formatter={(v) => [`${v} ${unidad}`, ""]} />
          <Bar dataKey="valor" fill="var(--viz-serie)" radius={[0, 4, 4, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Curva de inscripciones por día: una sola serie, sin leyenda. */
export function AreaTemporal({ datos }: { datos: Punto[] }) {
  return (
    <div className="viz h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={datos} margin={{ top: 8, right: 8, bottom: 4, left: -20 }}>
          <defs>
            <linearGradient id="degradadoInscripciones" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--viz-serie)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--viz-serie)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
          <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={{ stroke: "var(--viz-axis)" }} />
          <YAxis tick={EJE} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip {...estiloTooltip()} formatter={(v) => [`${v} inscripciones`, ""]} />
          <Area
            type="monotone"
            dataKey="valor"
            stroke="var(--viz-serie)"
            strokeWidth={2}
            fill="url(#degradadoInscripciones)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
