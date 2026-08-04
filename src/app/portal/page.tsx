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
  TarjetaResultado,
} from "@/components/portal/Historial";
import { BotonEnlace } from "@/components/ui/Boton";

export const dynamic = "force-dynamic";

/** Cuántas carreras se listan antes de mandar a la lista completa. */
const VISIBLES = 5;

export default async function PortalPage() {
  const perfil = await getPerfilActual();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const t = await trayectoriaDelCorredor(user.id);

  // El nombre de la ciudad vive en el catálogo, no en el perfil.
  const { data: ciudad } = perfil?.ciudad_id
    ? await supabase.from("ciudades").select("nombre").eq("id", perfil.ciudad_id).maybeSingle()
    : { data: null };

  const nombre = [perfil?.nombres, perfil?.apellidos].filter(Boolean).join(" ") || "Mi cuenta";
  const sinCarreras = t.finalizadas.length === 0;

  return (
    <div className="-mx-6 -my-8 flex flex-col lg:-mx-8">
      <CabeceraPerfil
        nombre={nombre}
        ciudad={ciudad?.nombre}
        desdeAnio={t.desdeAnio}
        club={t.club}
      />

      {/* Ningún bloque se pinta vacío: sin carreras finalizadas la tira de
          métricas serían tres guiones, así que desaparece. */}
      {!sinCarreras && (
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
            {
              etiqueta: t.metricas.mejor
                ? `Mejor ${formatDistancia(t.metricas.mejor.distanciaKm) ?? "marca"}`
                : "Mejor marca",
              valor: t.metricas.mejor ? formatTiempo(t.metricas.mejor.tiempo) : "—",
            },
          ]}
        />
      )}

      <div className="flex flex-col gap-7 px-6 py-6">
        {perfil && !perfilCompleto(perfil) && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/8 px-5 py-4">
            <p className="text-sm text-amber-300">
              Completa tu perfil para poder inscribirte a una carrera.
            </p>
            <BotonEnlace href="/portal/perfil" variante="primaria" tamano="sm">
              Completar
            </BotonEnlace>
          </div>
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
            <h2 className="text-lg font-extrabold tracking-display text-texto">
              Aún no tienes carreras
            </h2>
            <p className="text-sm text-texto/50">Tu primer tiempo aparecerá aquí.</p>
            <BotonEnlace href="/eventos" variante="primaria" className="mt-1">
              Explorar carreras
            </BotonEnlace>
          </div>
        ) : (
          <section className="flex flex-col gap-2.5">
            <EncabezadoSeccion>Historial y tiempos</EncabezadoSeccion>
            {t.finalizadas.slice(0, VISIBLES).map((c) => (
              <TarjetaResultado key={c.inscripcionId} carrera={c} />
            ))}
            {t.finalizadas.length > VISIBLES && (
              <BotonEnlace
                href="/portal/inscripciones?estado=finalizadas"
                variante="fantasma"
                ancho
                className="border border-linea-fuerte"
              >
                Ver todas mis carreras
              </BotonEnlace>
            )}
          </section>
        )}

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
