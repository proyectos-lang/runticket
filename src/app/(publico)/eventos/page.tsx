import { Suspense } from "react";
import type { Metadata } from "next";
import {
  listarEventosPublicos,
  contarPorDisciplina,
  departamentosConCarreras,
} from "@/lib/eventos/consultas";
import { esUrgente } from "@/lib/eventos/urgencia";
import { DISCIPLINA_LABEL } from "@/lib/disciplinas";
import Link from "next/link";
import { FilaCarrera } from "@/components/publico/FilaCarrera";
import { TarjetaCarrera } from "@/components/publico/TarjetaCarrera";
import { PildoraEnlace } from "@/components/ui/Pildora";
import { BotonEnlace } from "@/components/ui/Boton";
import { EtiquetaMono } from "@/components/ui/Datos";
import { FiltrosEventos } from "./FiltrosEventos";
import type { Disciplina } from "@/lib/supabase/database.types";

export const metadata: Metadata = {
  title: "Carreras | RunTicket",
  description: "Explora las próximas carreras y eventos deportivos e inscríbete en línea.",
};

export const dynamic = "force-dynamic";

/** "10-21" → { min: 10, max: 21 }; "21-" → { min: 21 } */
function parseDistancia(valor?: string) {
  if (!valor) return {};
  const [min, max] = valor.split("-");
  return {
    distanciaMin: min ? Number(min) : undefined,
    distanciaMax: max ? Number(max) : undefined,
  };
}

type Busqueda = {
  q?: string;
  ciudad?: string;
  mes?: string;
  distancia?: string;
  disciplina?: string;
  departamento?: string;
  precioMax?: string;
  orden?: string;
  vista?: string;
};

export default async function EventosPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const p = await searchParams;

  const [eventos, conteoDisciplinas, departamentos] = await Promise.all([
    listarEventosPublicos({
      q: p.q,
      ciudad: p.ciudad,
      mes: p.mes,
      disciplina: p.disciplina as Disciplina | undefined,
      departamentoId: p.departamento,
      precioMax: p.precioMax ? Number(p.precioMax) : undefined,
      ...parseDistancia(p.distancia),
    }),
    contarPorDisciplina(),
    departamentosConCarreras(),
  ]);

  // El orden por defecto es por fecha ascendente: quien busca carrera busca la
  // próxima, no la más barata.
  const ordenados =
    p.orden === "precio"
      ? [...eventos].sort((a, b) => (a.precioDesde ?? Infinity) - (b.precioDesde ?? Infinity))
      : eventos;

  // Solo la primera carrera urgente se resalta; ver el comentario de FilaCarrera.
  const idDestacado = ordenados.find(esUrgente)?.id ?? null;

  const activos = (
    ["q", "ciudad", "mes", "distancia", "disciplina", "departamento", "precioMax"] as const
  ).filter((k) => p[k]).length;
  const enRejilla = p.vista === "rejilla";

  function enlaceCon(clave: string, valor: string) {
    const n = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]);
    if (valor) n.set(clave, valor);
    else n.delete(clave);
    return `/eventos?${n.toString()}`;
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col lg:flex-row">
      <aside className="shrink-0 border-b border-linea px-6 py-7 lg:w-66 lg:border-b-0 lg:border-r">
        <Suspense fallback={<div className="h-96" />}>
          <FiltrosEventos conteoDisciplinas={conteoDisciplinas} departamentos={departamentos} />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-6 px-6 py-7 lg:px-10 lg:pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="display text-3xl text-texto">
              {p.disciplina ? DISCIPLINA_LABEL[p.disciplina as Disciplina] : "Carreras"}
            </h1>
            <p className="tabular font-mono text-[0.6875rem] uppercase tracking-etiqueta text-mudo">
              {ordenados.length} {ordenados.length === 1 ? "resultado" : "resultados"}
              {activos > 0 &&
                ` · ${activos} ${activos === 1 ? "filtro activo" : "filtros activos"}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <EtiquetaMono>Orden</EtiquetaMono>
              <PildoraEnlace href={enlaceCon("orden", "")} activa={p.orden !== "precio"}>
                Fecha
              </PildoraEnlace>
              <PildoraEnlace href={enlaceCon("orden", "precio")} activa={p.orden === "precio"}>
                Precio
              </PildoraEnlace>
            </div>
            {/* Dos cajas unidas: es un conmutador, no dos filtros sueltos. */}
            <div className="flex overflow-hidden rounded-md border border-linea-fuerte">
              {(
                [
                  { valor: "", glifo: "☰", texto: "Ver como lista", activa: !enRejilla },
                  { valor: "rejilla", glifo: "▦", texto: "Ver como rejilla", activa: enRejilla },
                ] as const
              ).map((v) => (
                <Link
                  key={v.texto}
                  href={enlaceCon("vista", v.valor)}
                  aria-label={v.texto}
                  aria-current={v.activa ? "true" : undefined}
                  className={`flex size-9 items-center justify-center text-sm transition-colors ${
                    v.activa ? "bg-texto text-fondo" : "text-atenuado hover:text-texto"
                  }`}
                >
                  {v.glifo}
                </Link>
              ))}
            </div>
          </div>
        </header>

        {ordenados.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-linea-fuerte px-6 py-14 text-center">
            <p className="text-sm text-atenuado">No encontramos carreras con esos filtros.</p>
            {activos > 0 && (
              <BotonEnlace href="/eventos" variante="primaria" tamano="sm">
                Limpiar filtros
              </BotonEnlace>
            )}
          </div>
        ) : enRejilla ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ordenados.map((e) => (
              <TarjetaCarrera key={e.id} evento={e} destacada={e.id === idDestacado} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ordenados.map((e) => (
              <FilaCarrera key={e.id} evento={e} destacada={e.id === idDestacado} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
