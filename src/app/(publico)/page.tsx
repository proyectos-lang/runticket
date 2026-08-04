import Link from "next/link";
import { listarEventosPublicos, categoriasConCupo } from "@/lib/eventos/consultas";
import { DISCIPLINAS, DISCIPLINA_LABEL } from "@/lib/disciplinas";
import { TarjetaCarrera } from "@/components/publico/TarjetaCarrera";
import { HeroEvento } from "@/components/publico/HeroEvento";
import { PildoraEnlace } from "@/components/ui/Pildora";
import { esUrgente } from "@/lib/eventos/urgencia";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const eventos = await listarEventosPublicos({ soloFuturos: true });
  const [destacada, ...resto] = eventos;

  // Los cupos solo se piden para la destacada: es el único sitio de la portada
  // donde se muestra escasez, y son una consulta extra por evento.
  let cupos: { disponibles: number; totales: number } | null = null;
  if (destacada) {
    const categorias = await categoriasConCupo(destacada.id);
    const conTope = categorias.filter((c) => c.cupo_maximo !== null);
    // Si ninguna categoría tiene tope no hay escasez que contar, y «0 de 0
    // cupos» sería peor que no decir nada.
    if (conTope.length) {
      cupos = {
        disponibles: conTope.reduce((a, c) => a + (c.cupos_disponibles ?? 0), 0),
        totales: conTope.reduce((a, c) => a + (c.cupo_maximo ?? 0), 0),
      };
    }
  }

  // Las disciplinas sin ninguna carrera no se ofrecen como filtro: un chip que
  // siempre devuelve cero es una promesa incumplida.
  const conCarreras = DISCIPLINAS.filter((d) => eventos.some((e) => e.disciplina === d));

  // Solo una tarjeta de la rejilla puede llevar el borde naranja de urgencia.
  const visibles = resto.slice(0, 6);
  const idDestacado = visibles.find(esUrgente)?.id ?? null;

  return (
    <main>
      {destacada && <HeroEvento evento={destacada} cupos={cupos} />}

      <section className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-14 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="display text-2xl text-texto">Próximas carreras</h2>
          <div className="flex flex-wrap gap-2">
            <PildoraEnlace href="/eventos" activa>
              Todas
            </PildoraEnlace>
            {conCarreras.map((d) => (
              <PildoraEnlace key={d} href={`/eventos?disciplina=${d}`}>
                {DISCIPLINA_LABEL[d]}
              </PildoraEnlace>
            ))}
          </div>
        </div>

        {resto.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibles.map((evento) => (
              <TarjetaCarrera
                key={evento.id}
                evento={evento}
                destacada={evento.id === idDestacado}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-linea-fuerte px-6 py-12 text-center text-atenuado">
            {destacada
              ? "Por ahora solo está publicada la carrera de arriba."
              : "Todavía no hay carreras publicadas. Vuelve pronto."}
          </p>
        )}

        {resto.length > 6 && (
          <Link
            href="/eventos"
            className="self-start font-mono text-xs uppercase tracking-etiqueta text-cian transition-colors hover:text-texto"
          >
            Ver todas →
          </Link>
        )}
      </section>
    </main>
  );
}
