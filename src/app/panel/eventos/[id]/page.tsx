import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { formatFechaHora } from "@/lib/format";
import { cambiarEstadoEvento } from "../actions";
import { TarjetaModulo, GrupoTarjetas } from "@/components/panel/TarjetaModulo";
import { PASOS_CONFIGURACION } from "@/components/shell/navegacion";
import { BotonEnlace } from "@/components/ui/Boton";
import { AvisoPublicacion, pendientesDePublicacion } from "@/components/panel/EstadoEvento";
import { TarjetaMetricaPanel } from "@/components/panel/Medidores";
import type { EstadoEvento, ResumenEvento } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

/** Transiciones ofrecidas según el estado actual: no todas tienen sentido siempre. */
const SIGUIENTES: Record<EstadoEvento, { estado: EstadoEvento; etiqueta: string }[]> = {
  borrador: [{ estado: "publicado", etiqueta: "Publicar evento" }],
  publicado: [
    { estado: "inscripciones_cerradas", etiqueta: "Cerrar inscripciones" },
    { estado: "cancelado", etiqueta: "Cancelar evento" },
  ],
  inscripciones_cerradas: [
    { estado: "publicado", etiqueta: "Reabrir inscripciones" },
    { estado: "finalizado", etiqueta: "Marcar como finalizado" },
    { estado: "cancelado", etiqueta: "Cancelar evento" },
  ],
  finalizado: [],
  cancelado: [{ estado: "borrador", etiqueta: "Devolver a borrador" }],
};

export default async function EventoResumenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membresia = await getEmpresaActivaDelPanel();
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select("*")
    .eq("id", id)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) notFound();

  // Un único viaje al servidor para los ~16 contadores del centro de mando.
  const { data } = await supabase.rpc("resumen_evento", { p_evento_id: id });
  const r = (data ?? {}) as Partial<ResumenEvento>;

  const esAdmin = membresia.rol === "admin_empresa";
  const base = `/panel/eventos/${id}`;
  const n = (v: number | undefined) => v ?? 0;

  const pendientes = pendientesDePublicacion(r, base);

  // La acción naranja de la barra es la que hace avanzar la carrera: publicar
  // mientras es borrador, y cerrar inscripciones una vez publicada. Cancelar
  // nunca es la acción principal.
  const accionPrincipal: EstadoEvento | null =
    evento.estado === "borrador"
      ? "publicado"
      : evento.estado === "publicado"
        ? "inscripciones_cerradas"
        : evento.estado === "inscripciones_cerradas"
          ? "finalizado"
          : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-3 sm:grid-cols-4">
        <TarjetaMetricaPanel label="Inscritos" valor={n(r.inscritos)} />
        <TarjetaMetricaPanel label="Presentes" valor={n(r.asistencias)} />
        <TarjetaMetricaPanel label="Kits entregados" valor={n(r.kits_entregados)} />
        <TarjetaMetricaPanel
          label="En lista de espera"
          valor={n(r.en_espera)}
          tono={n(r.en_espera) ? "info" : "neutro"}
          nota={n(r.en_espera) ? "esperando cupo" : undefined}
        />
      </div>

      {esAdmin && evento.estado === "borrador" && <AvisoPublicacion pendientes={pendientes} />}

      <section className="rounded-2xl border p-6 border-linea bg-superficie">
        <h2 className="mb-3 text-lg font-semibold text-texto">Cuándo y dónde</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-atenuado">Inicio</dt>
            <dd className="text-texto">
              {formatFechaHora(evento.fecha_inicio, evento.zona_horaria)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-atenuado">Cierre de inscripciones</dt>
            <dd className="text-texto">
              {evento.fecha_limite_inscripcion
                ? formatFechaHora(evento.fecha_limite_inscripcion, evento.zona_horaria)
                : "Hasta el día del evento"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-atenuado">Dirección</dt>
            <dd className="text-texto">{evento.direccion ?? "Sin definir"}</dd>
          </div>
        </dl>
      </section>

      {esAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4 border-linea bg-superficie">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm font-semibold text-texto">
              ¿Montando esta carrera desde cero?
            </p>
            <p className="max-w-140 text-sm text-atenuado">
              El asistente te lleva por las {PASOS_CONFIGURACION.length} secciones en orden, sin
              que se te olvide ninguna. Abajo tienes todas sueltas para entrar directo a una.
            </p>
          </div>
          <BotonEnlace href={`${base}/${PASOS_CONFIGURACION[0].segmento}`} variante="secundaria">
            Configurar paso a paso
          </BotonEnlace>
        </div>
      )}

      {esAdmin && (
        <GrupoTarjetas titulo="Configuración de la carrera">
          <TarjetaModulo
            href={`${base}/editar`}
            icono="editar"
            titulo="Datos"
            detalle={r.tiene_descripcion ? "Nombre, fechas y descripción" : "Falta la descripción"}
            estado={r.tiene_descripcion ? "neutro" : "pendiente"}
          />
          <TarjetaModulo
            href={`${base}/imagenes`}
            icono="imagenes"
            titulo="Imágenes"
            detalle={
              r.tiene_banner
                ? `Portada lista · ${n(r.imagenes)} en galería`
                : "Sin portada: se verá vacía al compartir"
            }
            estado={r.tiene_banner ? "ok" : "pendiente"}
          />
          <TarjetaModulo
            href={`${base}/ubicacion`}
            icono="ubicacion"
            titulo="Ubicación y ruta"
            detalle={
              r.tiene_ubicacion
                ? r.tiene_ruta
                  ? "Mapa y trazado listos"
                  : "Mapa listo, sin trazado GPX"
                : "Sin coordenadas: no se muestra el mapa"
            }
            estado={r.tiene_ubicacion ? "ok" : "pendiente"}
          />
          <TarjetaModulo
            href={`${base}/categorias`}
            icono="categorias"
            titulo="Categorías"
            detalle={
              n(r.categorias) ? `${r.categorias} configuradas` : "Sin categorías: nadie puede inscribirse"
            }
            estado={n(r.categorias) ? "ok" : "pendiente"}
          />
          <TarjetaModulo
            href={`${base}/precios`}
            icono="precios"
            titulo="Precios por fecha"
            detalle={n(r.tramos_precio) ? `${r.tramos_precio} tramos` : "Solo precio base"}
          />
          <TarjetaModulo
            href={`${base}/tallas`}
            icono="tallas"
            titulo="Tallas e inventario"
            detalle={n(r.tallas) ? `${r.tallas} tallas` : "Sin prendas configuradas"}
          />
          <TarjetaModulo
            href={`${base}/patrocinadores`}
            icono="patrocinadores"
            titulo="Patrocinadores"
            detalle={n(r.patrocinadores) ? `${r.patrocinadores} logos` : "Ninguno todavía"}
          />
          <TarjetaModulo
            href={`${base}/declaracion`}
            icono="bitacora"
            titulo="Declaración de salud"
            detalle="El deslinde que firma cada corredor"
          />
        </GrupoTarjetas>
      )}

      <GrupoTarjetas titulo="Participantes y día de carrera">
        <TarjetaModulo
          href={`${base}/inscritos`}
          icono="inscritos"
          titulo="Inscritos"
          detalle={n(r.inscritos) ? `${r.inscritos} apuntados` : "Nadie inscrito aún"}
        />
        {esAdmin && (
          <TarjetaModulo
            href={`${base}/inscribir`}
            icono="inscritos"
            titulo="Inscribir en mesa"
            detalle="Alta presencial el día del evento"
          />
        )}
        {esAdmin && (
          <TarjetaModulo
            href={`${base}/transferir`}
            icono="volver"
            titulo="Transferir inscripción"
            detalle="Ceder una plaza a otra persona"
          />
        )}
        <TarjetaModulo
          href={`/panel/asistencia?evento=${id}`}
          icono="asistencia"
          titulo="Control de asistencia"
          detalle={`${n(r.asistencias)} de ${n(r.inscritos)} presentes`}
        />
        <TarjetaModulo
          href={`${base}/checkin`}
          icono="kits"
          titulo="Entrega de kits"
          detalle={`${n(r.kits_entregados)} de ${n(r.inscritos)} entregados`}
        />
        {esAdmin && (
          <TarjetaModulo
            href={`${base}/lista-espera`}
            icono="listaEspera"
            titulo="Lista de espera"
            detalle={n(r.en_espera) ? `${r.en_espera} esperando cupo` : "Nadie en la cola"}
            estado={n(r.en_espera) ? "pendiente" : "neutro"}
          />
        )}
      </GrupoTarjetas>

      <GrupoTarjetas titulo="Después de la carrera">
        <TarjetaModulo
          href={`${base}/resultados`}
          icono="resultados"
          titulo="Resultados"
          detalle={
            n(r.resultados)
              ? `${r.resultados} tiempos · ${n(r.resultados_publicados)} publicados`
              : "Sin tiempos cargados"
          }
          estado={n(r.resultados_publicados) ? "ok" : "neutro"}
        />
        {esAdmin && (
          <TarjetaModulo
            href={`${base}/metricas`}
            icono="metricas"
            titulo="Métricas"
            detalle="Demografía, cupos y conversión de pago"
          />
        )}
        {esAdmin && (
          <TarjetaModulo
            href="/panel/pagos"
            icono="pagos"
            titulo="Pagos"
            detalle="Conciliación y verificación de comprobantes"
          />
        )}
        <TarjetaModulo
          href={`${base}/cronometraje.csv`}
          icono="resultados"
          titulo="Exportar para cronometraje"
          detalle="Padrón en CSV para la empresa de cronometraje"
          descarga
        />
      </GrupoTarjetas>

      {esAdmin && SIGUIENTES[evento.estado].length > 0 && (
        <section className="flex flex-wrap gap-2 border-t pt-6 border-linea">
          {SIGUIENTES[evento.estado].map((t) => (
            <form key={t.estado} action={cambiarEstadoEvento.bind(null, evento.id, t.estado)}>
              <button
                // No se puede publicar una carrera a la que le faltan categorías,
                // portada o ubicación: saldría rota en la web pública.
                disabled={t.estado === "publicado" && pendientes.length > 0}
                className={`inline-flex h-11 shrink-0 items-center justify-center rounded-md px-5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${ t.estado === "cancelado" ? "border border-red-500/35 font-medium text-red-300 hover:bg-red-500/10" : t.estado === accionPrincipal ? "bg-naranja font-extrabold uppercase tracking-wide text-tinta hover:bg-naranja-suave" : "border border-linea-fuerte bg-superficie font-medium text-texto hover:border-texto/25" }`}
              >
                {t.etiqueta}
              </button>
            </form>
          ))}
        </section>
      )}
    </div>
  );
}

