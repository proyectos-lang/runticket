import { Suspense } from "react";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { listarInscritos, filtrosDeParams, LIMITE_INFORME } from "@/lib/eventos/inscritos";
import { resumirInscritos } from "@/lib/eventos/resumenInscritos";
import { formatPrecio, formatFechaCorta } from "@/lib/format";
import { ESTADO_PAGO_LABEL, ESTADO_PAGO_TONO } from "@/lib/pagos";
import { Chip } from "@/components/ui/Chip";
import { Aviso } from "@/components/ui/Aviso";
import { claseBoton } from "@/components/ui/Boton";
import { FiltrosInscritos } from "./FiltrosInscritos";
import { ResumenInscritos } from "./ResumenInscritos";
import { AccionesInscrito } from "@/app/panel/eventos/[id]/inscritos/AccionesInscrito";
import type { Sexo } from "@/lib/supabase/database.types";

const SEXO_CORTO: Record<Sexo, string> = { femenino: "F", masculino: "M", otro: "—" };

/**
 * El padrón como informe: cifras arriba, filtros, tabla y salida a Excel.
 *
 * Lo comparten las dos rutas —la global, que puede abarcar todas las carreras, y
 * la de una carrera concreta— porque son la misma pantalla con distinto alcance.
 * Cuando eran dos copias, la de dentro del evento se quedaba atrás en cada
 * cambio.
 *
 * `eventoId` en `null` significa todas las carreras de la empresa; entonces
 * aparece la columna «Carrera» y el filtro por carrera, que dentro de una sobran.
 */
export async function InformeInscritos({
  eventoId,
  params,
  basePath,
  selector,
}: {
  eventoId: string | null;
  params: URLSearchParams;
  /** Dónde vive esta pantalla, para componer el enlace de exportación. */
  basePath: string;
  /** El selector de carrera de la vista global; dentro de un evento, nada. */
  selector?: React.ReactNode;
}) {
  const membresia = await getEmpresaActivaDelPanel();

  // El operador no tiene permiso de lectura sobre `pagos`: no se le muestra la
  // columna, no se intenta cargarla y tampoco se le calcula el dinero.
  const puedeVerPagos = membresia.rol === "admin_empresa";
  // Mover de categoría, cambiar talla o anular son decisiones del administrador,
  // no del operador que solo entrega kits.
  const puedeGestionar = puedeVerPagos;

  const filtros = filtrosDeParams(params);
  const { filas, truncado, ...catalogo } = await listarInscritos(eventoId, filtros, puedeVerPagos);
  const resumen = resumirInscritos(filas, catalogo.categorias, { incluirDinero: puedeVerPagos });

  const todasLasCarreras = eventoId === null;
  const consulta = params.toString();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {selector}
        <a
          href={`${basePath}/exportar.xlsx${consulta ? `?${consulta}` : ""}`}
          className={claseBoton("secundaria", "md", "ml-auto")}
        >
          Exportar a Excel
        </a>
      </div>

      {truncado && (
        <Aviso tono="ambar" titulo={`Se muestran las ${LIMITE_INFORME.toLocaleString("es-HN")} más recientes`}>
          Hay más inscripciones de las que caben en una pantalla. Acota con los filtros —por
          carrera o por categoría— para verlas todas; la exportación aplica el mismo tope.
        </Aviso>
      )}

      <Suspense fallback={<div className="h-24" />}>
        <FiltrosInscritos
          catalogo={catalogo}
          mostrarPago={puedeVerPagos}
          mostrarCarrera={todasLasCarreras}
        />
      </Suspense>

      {filas.length ? (
        <>
          <ResumenInscritos resumen={resumen} mostrarDinero={puedeVerPagos} />

          <div className="overflow-x-auto rounded-2xl border border-linea">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead className="text-xs uppercase tracking-wide bg-superficie text-atenuado">
                <tr>
                  <th className="px-4 py-3">Dorsal</th>
                  <th className="px-4 py-3">Corredor</th>
                  {todasLasCarreras && <th className="px-4 py-3">Carrera</th>}
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Talla</th>
                  <th className="px-4 py-3">Género</th>
                  <th className="px-4 py-3">Edad</th>
                  <th className="px-4 py-3">Inscrito</th>
                  {puedeVerPagos && <th className="px-4 py-3">Pago</th>}
                  <th className="px-4 py-3">Kit</th>
                  {puedeGestionar && !todasLasCarreras && <th className="px-4 py-3">Gestionar</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {filas.map((f) => (
                  <tr key={f.id} className="bg-superficie/40">
                    <td className="px-4 py-3 font-semibold tabular-nums text-texto">
                      {f.numeroDorsal ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-texto">{f.nombre}</p>
                      {/* Un acompañante no tiene correo propio al que escribir:
                          lo que el organizador necesita es a quién llamar. */}
                      {f.gestionadoPor ? (
                        <p className="text-xs text-cian">
                          Acompañante de {f.gestionadoPor.nombre ?? "otro corredor"}
                          {f.gestionadoPor.telefono && ` · ${f.gestionadoPor.telefono}`}
                        </p>
                      ) : (
                        <p className="text-xs text-atenuado">{f.correo}</p>
                      )}
                      {f.club && <p className="text-xs text-mudo">{f.club}</p>}
                    </td>
                    {todasLasCarreras && (
                      <td className="px-4 py-3 text-atenuado">{f.evento}</td>
                    )}
                    <td className="px-4 py-3 text-atenuado">{f.categoria}</td>
                    <td className="px-4 py-3 text-atenuado">{f.talla ?? "—"}</td>
                    <td className="px-4 py-3 text-atenuado">
                      {f.sexo ? SEXO_CORTO[f.sexo] : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-atenuado">{f.edad ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-atenuado">
                      {formatFechaCorta(f.creadoEn)}
                    </td>
                    {puedeVerPagos && (
                      <td className="px-4 py-3">
                        <Chip tono={ESTADO_PAGO_TONO[f.pago?.estado ?? "pendiente"]}>
                          {f.pago ? ESTADO_PAGO_LABEL[f.pago.estado] : "Sin registrar"}
                        </Chip>
                        <p className="mt-1 text-xs text-atenuado">
                          {formatPrecio(f.pago?.monto ?? f.precio, f.moneda)}
                        </p>
                        {/* El comprobante ya se consultaba y no se enseñaba en
                            ningún sitio: para aprobar un pago hay que verlo. */}
                        {f.pago?.comprobanteUrl && (
                          <a
                            href={`/panel/pagos?evento=${f.eventoId}`}
                            className="text-xs underline-offset-2 hover:underline text-cian"
                          >
                            Ver comprobante
                          </a>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-atenuado">
                      {f.kitEntregado ? (
                        <span className="text-emerald-300">
                          Entregado
                          {f.kitEntregadoEn && (
                            <span className="block text-xs text-mudo">
                              {formatFechaCorta(f.kitEntregadoEn)}
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    {puedeGestionar && !todasLasCarreras && (
                      <td className="px-4 py-3 align-top">
                        <AccionesInscrito
                          eventoId={f.eventoId}
                          inscripcionId={f.id}
                          nombre={f.nombre}
                          categoriaActual={f.categoriaId}
                          tallaActual={f.talla}
                          categorias={catalogo.categorias}
                          tallas={catalogo.tallas}
                          kitEntregado={f.kitEntregado}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm border-linea-fuerte text-atenuado">
          No hay inscritos que coincidan con los filtros.
        </p>
      )}
    </div>
  );
}
