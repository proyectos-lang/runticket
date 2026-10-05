import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/auth/session";
import { perfilCompleto } from "@/lib/validacion/perfil";
import { trayectoriaDelCorredor } from "@/lib/portal/trayectoria";
import { formatTiempo, formatDistancia } from "@/lib/format";
import {
  CabeceraPerfil,
  TiraMetricas,
  EncabezadoSeccion,
  FilaProxima,
  TarjetaCarrera,
  RecordsPorDistancia,
} from "@/components/portal/Historial";
import { Insignias } from "@/components/portal/Insignias";
import { CompartirImagen } from "@/components/portal/CompartirImagen";
import { BotonEnlace } from "@/components/ui/Boton";

/** Cuántas carreras se listan antes de mandar a la lista completa. */
const VISIBLES = 4;

/**
 * La portada del corredor: su tarjeta de presentación.
 *
 * Arriba, quién es y sus cifras; después lo que tiene por delante; después el
 * álbum de lo corrido, con la portada de cada carrera y el tiempo encima; y un
 * botón para llevárselo a redes. Las insignias cierran, como las medallas en
 * la pared.
 */
export default async function PortalPage() {
  const perfil = await getPerfilActual();
  if (!perfil) return null;
  const supabase = await createClient();

  const [t, { data: ciudad }, { data: insignias }] = await Promise.all([
    trayectoriaDelCorredor(perfil.id),
    // El nombre de la ciudad vive en el catálogo, no en el perfil.
    perfil.ciudad_id
      ? supabase.from("ciudades").select("nombre").eq("id", perfil.ciudad_id).maybeSingle()
      : Promise.resolve({ data: null as { nombre: string } | null }),
    // La función filtra por `auth.uid()`: nunca devuelve las de otro corredor.
    supabase.rpc("insignias_de_corredor"),
  ]);

  const nombre = [perfil.nombres, perfil.apellidos].filter(Boolean).join(" ") || "Mi cuenta";
  const sinCarreras = t.finalizadas.length === 0;
  const conTiempos = t.metricas.carreras > 0;

  return (
    <div className="-mx-6 -my-8 flex flex-col lg:-mx-8">
      <CabeceraPerfil
        nombre={nombre}
        fotoUrl={perfil.foto_url}
        ciudad={ciudad?.nombre}
        desdeAnio={t.desdeAnio}
        club={t.club}
      />

      {/* Ningún bloque se pinta vacío: sin carreras finalizadas la tira de
          métricas serían tres guiones, así que desaparece. */}
      {conTiempos && (
        <TiraMetricas
          metricas={[
            {
              etiqueta: t.metricas.carreras === 1 ? "Carrera" : "Carreras",
              valor: t.metricas.carreras.toLocaleString("es-HN"),
            },
            {
              etiqueta: "Km totales",
              valor: t.metricas.kmTotales.toLocaleString("es-HN"),
              destacado: true,
            },
            t.metricas.podios > 0
              ? {
                  etiqueta: t.metricas.podios === 1 ? "Podio" : "Podios",
                  valor: String(t.metricas.podios),
                }
              : {
                  etiqueta: t.metricas.mejor
                    ? `Mejor ${formatDistancia(t.metricas.mejor.distanciaKm) ?? "marca"}`
                    : "Mejor marca",
                  valor: t.metricas.mejor ? formatTiempo(t.metricas.mejor.tiempo) : "—",
                },
          ]}
        />
      )}

      <div className="flex flex-col gap-7 px-6 py-6">
        {!perfilCompleto(perfil) && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/8 px-5 py-4">
            <p className="text-sm text-amber-300">
              Completa tu perfil para poder inscribirte a una carrera.
            </p>
            <BotonEnlace href="/portal/perfil" variante="primaria" tamano="sm">
              Completar
            </BotonEnlace>
          </div>
        )}

        {t.metricas.mejores.length > 0 && (
          <section className="flex flex-col gap-3">
            <EncabezadoSeccion>Mejores marcas</EncabezadoSeccion>
            <RecordsPorDistancia mejores={t.metricas.mejores} />
          </section>
        )}

        <section className="flex flex-col gap-3">
          <EncabezadoSeccion>Próximas</EncabezadoSeccion>
          {t.proximas.length ? (
            t.proximas.map((c, i) => (
              <FilaProxima key={c.inscripcionId} carrera={c} destacada={i === 0} />
            ))
          ) : (
            <BotonEnlace
              href="/eventos"
              variante="fantasma"
              ancho
              className="border border-dashed border-texto/14"
            >
              ＋ Buscar mi próxima carrera
            </BotonEnlace>
          )}
        </section>

        {sinCarreras ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-linea bg-superficie px-6 py-10 text-center">
            <h2 className="display text-xl text-texto">Aún no tienes carreras</h2>
            <p className="text-sm text-texto/50">
              Tu primera portada, tu primer tiempo y tu primer récord aparecerán aquí.
            </p>
            {/* Con el perfil incompleto el naranja ya lo lleva «Completar». */}
            <BotonEnlace
              href="/eventos"
              variante={perfilCompleto(perfil) ? "primaria" : "secundaria"}
              className="mt-1"
            >
              Explorar carreras
            </BotonEnlace>
          </div>
        ) : (
          <section className="flex flex-col gap-3">
            <EncabezadoSeccion>Mis carreras</EncabezadoSeccion>
            {t.finalizadas.slice(0, VISIBLES).map((c) => (
              <TarjetaCarrera key={c.inscripcionId} carrera={c} />
            ))}
            {t.finalizadas.length > VISIBLES && (
              <BotonEnlace
                href="/portal/inscripciones?estado=finalizadas"
                variante="fantasma"
                ancho
                className="border border-linea-fuerte"
              >
                Ver las {t.finalizadas.length} carreras
              </BotonEnlace>
            )}
          </section>
        )}

        {conTiempos && (
          <section className="flex flex-col gap-3 rounded-xl border border-linea bg-superficie p-4">
            <div className="flex flex-col gap-1">
              <EtiquetaSeccion>Compartir mi historial</EtiquetaSeccion>
              <p className="text-sm text-atenuado">
                Tus cifras, tus mejores marcas y tus últimas carreras en una imagen para tu
                historia o tu publicación.
              </p>
            </div>
            <CompartirImagen
              url="/portal/compartir/historial.png"
              nombreArchivo="mi-historial"
              titulo="Mi historial de carreras"
              texto={`${t.metricas.carreras} carreras y ${t.metricas.kmTotales.toLocaleString("es-HN")} km con RunTicket HN`}
            />
          </section>
        )}

        <Insignias insignias={insignias ?? []} />

        <div className="flex flex-col gap-2.5">
          <BotonEnlace
            href="/portal/certificados"
            variante="fantasma"
            ancho
            className="border border-linea-fuerte"
          >
            Descargar certificados (PDF)
          </BotonEnlace>
          <BotonEnlace href="/portal/cuenta" variante="fantasma" ancho>
            Ajustes de cuenta
          </BotonEnlace>
        </div>
      </div>
    </div>
  );
}

function EtiquetaSeccion({ children }: { children: React.ReactNode }) {
  return <EncabezadoSeccion>{children}</EncabezadoSeccion>;
}
