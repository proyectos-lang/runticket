"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { DISCIPLINAS, DISCIPLINA_LABEL } from "@/lib/disciplinas";
import { formatPrecio } from "@/lib/format";
import { Boton } from "@/components/ui/Boton";
import { Pildora } from "@/components/ui/Pildora";
import { CLASE_CAMPO } from "@/components/ui/Campo";
import { EtiquetaMono } from "@/components/ui/Datos";

const RANGOS_DISTANCIA = [
  { etiqueta: "5K", valor: "0-5" },
  { etiqueta: "10K", valor: "5-10" },
  { etiqueta: "21K", valor: "10-21" },
  { etiqueta: "42K", valor: "21-42" },
  { etiqueta: "+50K", valor: "50-" },
];

/** Tope del deslizador. En el tope se entiende «sin límite» y se quita el filtro. */
const PRECIO_TOPE = 2000;

/** Los próximos 12 meses, para el selector de mes. */
function mesesDisponibles() {
  const hoy = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const etiqueta = new Intl.DateTimeFormat("es-HN", { month: "long", year: "numeric" }).format(d);
    return { valor, etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1) };
  });
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="pb-1">
        <EtiquetaMono>{titulo}</EtiquetaMono>
      </legend>
      {children}
    </fieldset>
  );
}

export function FiltrosEventos({
  conteoDisciplinas,
  departamentos,
}: {
  conteoDisciplinas: Record<string, number>;
  departamentos: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pendiente, startTransition] = useTransition();

  function actualizar(cambios: Record<string, string>) {
    const nuevos = new URLSearchParams(params.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) nuevos.set(clave, valor);
      else nuevos.delete(clave);
    }
    startTransition(() => router.push(`/eventos?${nuevos.toString()}`));
  }

  const disciplina = params.get("disciplina") ?? "";
  const distancia = params.get("distancia") ?? "";
  const precioMax = Number(params.get("precioMax") ?? PRECIO_TOPE);
  const hayFiltros = [...params.keys()].length > 0;

  // Solo se ofrecen las disciplinas que tienen alguna carrera: un filtro que
  // siempre devuelve cero resultados es ruido.
  const disciplinasVisibles = DISCIPLINAS.filter((d) => (conteoDisciplinas[d] ?? 0) > 0);

  return (
    <div className={`flex flex-col gap-7 ${pendiente ? "opacity-60" : ""}`} aria-busy={pendiente}>
      <EtiquetaMono className="block border-b border-linea pb-3">Filtros</EtiquetaMono>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="q" className="sr-only">
          Buscar carrera
        </label>
        <input
          id="q"
          type="search"
          placeholder="Nombre de la carrera"
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => actualizar({ q: e.target.value })}
          className={CLASE_CAMPO}
        />
      </div>

      {disciplinasVisibles.length > 0 && (
        <Grupo titulo="Disciplina">
          {disciplinasVisibles.map((d) => (
            <label
              key={d}
              className="flex cursor-pointer items-center gap-2.5 text-sm text-texto/62 transition-colors hover:text-texto"
            >
              <input
                type="checkbox"
                checked={disciplina === d}
                // Son excluyentes entre sí, pero se pintan como casillas: el
                // diseño las quiere cuadradas y un radio redondo rompería la
                // retícula de la barra lateral.
                onChange={(e) => actualizar({ disciplina: e.target.checked ? d : "" })}
                className="size-[0.9375rem] shrink-0 rounded-[0.25rem] border-linea-fuerte accent-naranja"
              />
              <span className="flex-1">{DISCIPLINA_LABEL[d]}</span>
              <span className="tabular font-mono text-[0.6875rem] text-texto/35">
                {conteoDisciplinas[d]}
              </span>
            </label>
          ))}
        </Grupo>
      )}

      <Grupo titulo="Distancia">
        <div className="flex flex-wrap gap-1.5">
          {RANGOS_DISTANCIA.map((r) => (
            <Pildora
              key={r.valor}
              forma="cuadrada"
              activa={distancia === r.valor}
              onClick={() => actualizar({ distancia: distancia === r.valor ? "" : r.valor })}
            >
              {r.etiqueta}
            </Pildora>
          ))}
        </div>
      </Grupo>

      <Grupo titulo={`Precio — hasta ${formatPrecio(precioMax)}`}>
        <input
          type="range"
          min={100}
          max={PRECIO_TOPE}
          step={50}
          defaultValue={precioMax}
          aria-label="Precio máximo"
          // Al llegar al tope el filtro se quita en vez de fijar 2.000: si se
          // quedara puesto escondería las carreras más caras sin que el usuario
          // entienda por qué.
          onChange={(e) =>
            actualizar({ precioMax: Number(e.target.value) >= PRECIO_TOPE ? "" : e.target.value })
          }
          className="w-full accent-naranja"
        />
        <p className="font-mono text-[0.625rem] text-texto/32">
          En el tope máximo el filtro se retira.
        </p>
      </Grupo>

      <Grupo titulo="Mes">
        <select
          aria-label="Mes"
          defaultValue={params.get("mes") ?? ""}
          onChange={(e) => actualizar({ mes: e.target.value })}
          className={CLASE_CAMPO}
        >
          <option value="">Cualquiera</option>
          {mesesDisponibles().map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.etiqueta}
            </option>
          ))}
        </select>
      </Grupo>

      {departamentos.length > 0 && (
        <Grupo titulo="Departamento">
          <select
            aria-label="Departamento"
            defaultValue={params.get("departamento") ?? ""}
            onChange={(e) => actualizar({ departamento: e.target.value })}
            className={CLASE_CAMPO}
          >
            <option value="">Todos</option>
            {departamentos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </Grupo>
      )}

      {hayFiltros && (
        <Boton
          variante="fantasma"
          ancho
          onClick={() => startTransition(() => router.push("/eventos"))}
        >
          Limpiar filtros
        </Boton>
      )}
    </div>
  );
}
