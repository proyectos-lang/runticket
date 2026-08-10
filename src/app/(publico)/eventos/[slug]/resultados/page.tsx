import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient, tagEvento } from "@/lib/supabase/publico";
import { formatFechaMono } from "@/lib/format";
import { PodioResultados } from "@/components/publico/PodioResultados";
import { EtiquetaMono } from "@/components/ui/Datos";
import { BotonEnlace } from "@/components/ui/Boton";
import type { ResultadoPublico } from "@/lib/supabase/database.types";
import { BuscadorResultados } from "./BuscadorResultados";

/**
 * Los resultados de una carrera ya corrida son el contenido más estable del
 * sitio y a la vez el que más se comparte: cuando el organizador los publica,
 * cientos de personas abren la misma tabla a la vez. Cachearla es justo lo que
 * hace que ese pico no se convierta en cientos de consultas idénticas.
 *
 * La etiqueta de la carrera cubre la publicación: el panel la invalida al
 * publicar o despublicar, así que el cambio se ve en el acto.
 */
async function cargar(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(tagEvento(slug));

  const supabase = createPublicClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("id, nombre, slug, fecha_inicio, zona_horaria")
    .eq("slug", slug)
    .maybeSingle();
  if (!evento) return null;

  const { data } = await supabase.rpc("resultados_publicos", { p_evento_id: evento.id });
  return { evento, resultados: (data as ResultadoPublico[] | null) ?? [] };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const datos = await cargar(slug);
  if (!datos) return { title: "Resultados | RunTicket" };
  return {
    title: `Resultados · ${datos.evento.nombre} | RunTicket`,
    description: `Consulta los tiempos y posiciones de ${datos.evento.nombre}.`,
  };
}

export default function ResultadosPublicosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-svh" />}>
      <Resultados params={params} />
    </Suspense>
  );
}

async function Resultados({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const datos = await cargar(slug);
  if (!datos) notFound();

  const { evento, resultados } = datos;

  // Podio por categoría: los tres mejores tiempos de cada una.
  const categorias = [...new Set(resultados.map((r) => r.categoria))].sort();
  const podios = categorias
    .map((categoria) => ({
      categoria,
      puestos: resultados
        .filter((r) => r.categoria === categoria && r.posicion_categoria !== null)
        .sort((a, b) => (a.posicion_categoria ?? 0) - (b.posicion_categoria ?? 0))
        .slice(0, 3),
    }))
    .filter((p) => p.puestos.length > 0);

  return (
    <main className="mx-auto flex max-w-5xl flex-col px-6 py-10">
      <div className="flex flex-col gap-2">
        <Link
          href={`/eventos/${slug}`}
          className="font-mono text-xs uppercase tracking-etiqueta text-mudo transition-colors hover:text-texto"
        >
          ‹ {evento.nombre}
        </Link>
        <h1 className="display text-3xl text-texto">Resultados</h1>
        <p className="tabular font-mono text-[0.6875rem] uppercase tracking-etiqueta text-texto/45">
          {formatFechaMono(evento.fecha_inicio, evento.zona_horaria)}
          {resultados.length > 0 &&
            ` · ${resultados.length} ${resultados.length === 1 ? "finalista" : "finalistas"}`}
        </p>
      </div>

      {resultados.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-xl border border-dashed border-linea-fuerte px-6 py-14 text-center">
          <p className="text-sm text-atenuado">
            El organizador aún no ha publicado los resultados de esta carrera.
          </p>
          <BotonEnlace href={`/eventos/${slug}`} variante="primaria" tamano="sm">
            Volver a la carrera
          </BotonEnlace>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-10">
          {podios.length > 0 && (
            <div className="flex flex-col gap-7">
              <EtiquetaMono>Podio</EtiquetaMono>
              {podios.map((p) => (
                <PodioResultados key={p.categoria} categoria={p.categoria} puestos={p.puestos} />
              ))}
            </div>
          )}

          <section className="flex flex-col gap-3">
            <EtiquetaMono>Clasificación general</EtiquetaMono>
            <BuscadorResultados resultados={resultados} categorias={categorias} />
          </section>
        </div>
      )}
    </main>
  );
}
