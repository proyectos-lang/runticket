import { Suspense } from "react";
import Link from "next/link";
import { listarEventosPublicos } from "@/lib/eventos/consultas";
import { DISCIPLINAS, DISCIPLINA_LABEL } from "@/lib/disciplinas";
import { TarjetaCarrera } from "@/components/publico/TarjetaCarrera";
import { HeroEvento } from "@/components/publico/HeroEvento";
import { ContadorCupos } from "@/components/publico/ContadorCupos";
import { PildoraEnlace } from "@/components/ui/Pildora";
import { BotonEnlace } from "@/components/ui/Boton";
import { enlaceWhatsAppPlataforma, MENSAJE_ORGANIZADOR, WHATSAPP_PLATAFORMA } from "@/lib/contacto";

/**
 * La portada es la página que más importa para SEO, así que se prerenderiza
 * entera: el catálogo sale de una consulta cacheada y no se mira el reloj en
 * ningún sitio —la urgencia de cada carrera viene ya calculada desde la caché—.
 *
 * Lo único que se calcula por visita son los cupos de la carrera destacada, y
 * por eso van dentro de su propio `<Suspense>`. Antes se pedían aquí arriba, y
 * esa sola línea impedía prerenderizar toda la portada.
 */
export default async function HomePage() {
  const eventos = await listarEventosPublicos({ soloFuturos: true });
  const [destacada, ...resto] = eventos;

  // Las disciplinas sin ninguna carrera no se ofrecen como filtro: un chip que
  // siempre devuelve cero es una promesa incumplida.
  const conCarreras = DISCIPLINAS.filter((d) => eventos.some((e) => e.disciplina === d));

  // Solo una tarjeta de la rejilla puede llevar el borde naranja de urgencia.
  const visibles = resto.slice(0, 6);
  const idDestacado = visibles.find((e) => e.urgente)?.id ?? null;

  return (
    <main>
      {destacada && (
        <HeroEvento
          evento={destacada}
          cupos={
            // Sin `fallback` visible: es una nota secundaria de escasez y un
            // «consultando…» parpadeando en cada carga molesta más de lo que
            // informa. Aparece cuando el dato es real.
            <Suspense fallback={null}>
              <ContadorCupos eventoId={destacada.id} />
            </Suspense>
          }
        />
      )}

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
      {/* La portada hablaba solo a corredores. Quien organiza carreras no tenía
          ninguna puerta y acababa entrando por «Entrar» como si fuera uno más. */}
      <section className="border-t border-linea">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-14 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div className="flex max-w-xl flex-col gap-2">
            <span className="font-mono text-[0.625rem] font-bold uppercase tracking-etiqueta text-mudo">
              Para organizadores
            </span>
            <h2 className="display text-2xl text-texto">¿Organizas carreras?</h2>
            <p className="text-sm leading-relaxed text-atenuado">
              Inscripciones en línea, pago con tarjeta o transferencia, dorsales con QR, entrega
              de kits y resultados, todo desde un solo panel. Si tu empresa ya está en RunTicket,
              entra con tu cuenta; si no, escríbenos por WhatsApp y la damos de alta.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
            <a
              href={enlaceWhatsAppPlataforma(MENSAJE_ORGANIZADOR)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-13 items-center justify-center rounded-md border border-linea-fuerte bg-superficie px-6 text-sm font-semibold text-texto transition-colors hover:border-texto/25"
            >
              WhatsApp {WHATSAPP_PLATAFORMA}
            </a>
            <BotonEnlace href="/login?como=organizador" variante="secundaria" tamano="lg">
              Entrar al panel
            </BotonEnlace>
          </div>
        </div>
      </section>
    </main>
  );
}
