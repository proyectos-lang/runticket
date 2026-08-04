import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { formatPrecio, formatFechaCorta } from "@/lib/format";
import {
  ESTADO_PAGO_LABEL,
  ESTADO_PAGO_TONO,
  METODO_PAGO_LABEL,
  resumirConciliacion,
} from "@/lib/pagos";
import { Chip } from "@/components/ui/Chip";
import { TarjetaMetrica, EtiquetaMono } from "@/components/ui/Datos";
import { CLASE_CAMPO } from "@/components/ui/Campo";
import { cambiarEstadoPago } from "./actions";
import { RegistrarPagoForm } from "./RegistrarPagoForm";
import { Boton } from "@/components/ui/Boton";

export const dynamic = "force-dynamic";

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<{ evento?: string }>;
}) {
  const { evento: eventoFiltro } = await searchParams;
  const membresia = await getEmpresaActivaDelPanel();

  // La información financiera está fuera del alcance del operador, igual que en
  // la RLS de la tabla `pagos`.
  if (membresia.rol !== "admin_empresa") redirect("/panel/eventos");

  const supabase = await createClient();

  const { data: eventos } = await supabase
    .from("eventos")
    .select("id, nombre, moneda")
    .eq("empresa_id", membresia.empresaId)
    .order("fecha_inicio", { ascending: false });

  const { data: pagos } = await supabase
    .from("pagos")
    .select(
      "id, inscripcion_id, monto, moneda, metodo, estado, comprobante_url, referencia_externa, notas, created_at, verificado_en"
    )
    .eq("empresa_id", membresia.empresaId)
    .order("created_at", { ascending: false });

  // Une cada pago con su inscripción, evento y corredor para poder mostrarlo y
  // filtrar por evento.
  const inscripcionIds = [...new Set((pagos ?? []).map((p) => p.inscripcion_id).filter(Boolean) as string[])];
  const { data: inscripciones } = inscripcionIds.length
    ? await supabase
        .from("inscripciones")
        .select("id, evento_id, corredor_id, categoria_id, numero_dorsal")
        .in("id", inscripcionIds)
    : { data: [] as never[] };

  // Inscripciones activas de la empresa: de aquí salen las candidatas a un cobro
  // manual. Se piden todas y se descartan después las que ya tienen un pago
  // confirmado, que es lo que de verdad define «quién debe».
  const { data: activas } = await supabase
    .from("inscripciones")
    .select("id, evento_id, corredor_id, categoria_id, numero_dorsal, precio_pagado, moneda")
    .eq("empresa_id", membresia.empresaId)
    .eq("estado", "activa")
    .order("created_at", { ascending: false });

  const corredorIds = [
    ...new Set([
      ...(inscripciones ?? []).map((i) => i.corredor_id),
      ...(activas ?? []).map((i) => i.corredor_id),
    ]),
  ];
  const { data: perfiles } = corredorIds.length
    ? await supabase.from("perfiles").select("id, nombres, apellidos, correo").in("id", corredorIds)
    : { data: [] as never[] };

  const categoriaIds = [...new Set((activas ?? []).map((i) => i.categoria_id))];
  const { data: categorias } = categoriaIds.length
    ? await supabase.from("categorias").select("id, nombre").in("id", categoriaIds)
    : { data: [] as never[] };

  let filas = (pagos ?? []).map((p) => {
    const insc = inscripciones?.find((i) => i.id === p.inscripcion_id);
    const perfil = perfiles?.find((x) => x.id === insc?.corredor_id);
    return {
      ...p,
      eventoId: insc?.evento_id ?? null,
      eventoNombre: eventos?.find((e) => e.id === insc?.evento_id)?.nombre ?? "—",
      dorsal: insc?.numero_dorsal ?? null,
      corredor: `${perfil?.nombres ?? ""} ${perfil?.apellidos ?? ""}`.trim() || perfil?.correo || "—",
    };
  });

  if (eventoFiltro) filas = filas.filter((f) => f.eventoId === eventoFiltro);

  const resumen = resumirConciliacion(filas);
  const porVerificar = filas.filter((f) => f.estado === "en_verificacion" || f.estado === "pendiente");
  const moneda = eventos?.[0]?.moneda ?? "HNL";

  // Quién sigue debiendo: activa y sin ningún pago en estado 'pagado'. Se mira
  // sobre `pagos` sin filtrar por evento, porque el filtro de la pantalla no
  // puede hacer que una inscripción parezca impagada.
  const yaCobradas = new Set(
    (pagos ?? []).filter((p) => p.estado === "pagado").map((p) => p.inscripcion_id)
  );
  const porCobrar = (activas ?? [])
    .filter((i) => !yaCobradas.has(i.id))
    .filter((i) => !eventoFiltro || i.evento_id === eventoFiltro)
    .map((i) => {
      const perfil = perfiles?.find((x) => x.id === i.corredor_id);
      return {
        id: i.id,
        corredor:
          `${perfil?.nombres ?? ""} ${perfil?.apellidos ?? ""}`.trim() || perfil?.correo || "Sin nombre",
        evento: eventos?.find((e) => e.id === i.evento_id)?.nombre ?? "—",
        categoria: categorias?.find((c) => c.id === i.categoria_id)?.nombre ?? "—",
        dorsal: i.numero_dorsal,
        monto: Number(i.precio_pagado),
        moneda: i.moneda,
      };
    });

  // Firma las URLs de los comprobantes que hay que revisar (bucket privado).
  const admin = createAdminClient();
  const urlsComprobante = new Map<string, string>();
  for (const f of porVerificar) {
    if (!f.comprobante_url) continue;
    const { data } = await admin.storage.from("comprobantes").createSignedUrl(f.comprobante_url, 600);
    if (data?.signedUrl) urlsComprobante.set(f.id, data.signedUrl);
  }

  const parametros = eventoFiltro ? `?evento=${eventoFiltro}` : "";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-texto">Pagos y conciliación</h1>
          <p className="text-sm text-atenuado">
            Verifica comprobantes y revisa lo recaudado.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form>
            <select
              name="evento"
              defaultValue={eventoFiltro ?? ""}
              // Sin JS de cliente: el select envía el formulario por GET.
              className="rounded-lg border px-3 py-2 text-sm border-linea-fuerte bg-superficie text-texto"
              aria-label="Filtrar por evento"
            >
              <option value="">Todos los eventos</option>
              {eventos?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="ml-2 rounded-full border px-4 py-2 text-sm font-medium border-linea-fuerte text-atenuado hover:bg-superficie-2"
            >
              Filtrar
            </button>
          </form>
          <a
            href={`/panel/pagos/exportar.csv${parametros}`}
            className="rounded-full border px-4 py-2 text-sm font-medium border-linea-fuerte text-atenuado hover:bg-superficie-2"
          >
            Exportar CSV
          </a>
        </div>
      </div>

      {/* Totales */}
      <div className="grid gap-4 sm:grid-cols-3">
        {([
          { etiqueta: "Recaudado", valor: resumen.totalPagado, tono: "exito" },
          { etiqueta: "En verificación", valor: resumen.totalEnVerificacion, tono: "aviso" },
          { etiqueta: "Pendiente", valor: resumen.totalPendiente, tono: "neutro" },
        ] as const).map((t) => (
          <TarjetaMetrica
            key={t.etiqueta}
            etiqueta={t.etiqueta}
            valor={formatPrecio(t.valor, moneda)}
            tono={t.tono}
          />
        ))}
      </div>

      {/* Por método y por día */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border p-5 border-linea bg-superficie">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-atenuado">
            Recaudado por método
          </h2>
          {resumen.porMetodo.length ? (
            <ul className="flex flex-col gap-2 text-sm">
              {resumen.porMetodo.map((m) => (
                <li key={m.metodo} className="flex items-center justify-between">
                  <span className="text-atenuado">
                    {METODO_PAGO_LABEL[m.metodo]}{" "}
                    <span className="text-xs text-atenuado">({m.cantidad})</span>
                  </span>
                  <span className="font-medium text-texto">
                    {formatPrecio(m.total, moneda)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-atenuado">Todavía no hay cobros confirmados.</p>
          )}
        </section>

        <section className="rounded-2xl border p-5 border-linea bg-superficie">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-atenuado">
            Recaudado por día
          </h2>
          {resumen.porDia.length ? (
            <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto text-sm">
              {resumen.porDia.map((d) => (
                <li key={d.dia} className="flex items-center justify-between">
                  <span className="text-atenuado">
                    {formatFechaCorta(d.dia)} <span className="text-xs text-atenuado">({d.cantidad})</span>
                  </span>
                  <span className="font-medium text-texto">
                    {formatPrecio(d.total, moneda)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-atenuado">Sin cobros registrados.</p>
          )}
        </section>
      </div>

      {/* Cola de verificación */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <EtiquetaMono>Comprobantes por aprobar</EtiquetaMono>
          {porVerificar.length > 0 && (
            <span className="tabular rounded-full border border-amber-500/38 bg-amber-500/14 px-2.5 py-1 font-mono text-[0.59375rem] font-bold uppercase tracking-etiqueta text-ambar">
              {porVerificar.length} esperando
            </span>
          )}
        </div>
        {porVerificar.length ? (
          porVerificar.map((f, i) => (
            <div
              key={f.id}
              // La primera de la cola se marca en ámbar: es la que toca resolver
              // ahora, y sin ella todas piden atención por igual.
              className={`flex flex-col gap-3 rounded-xl border bg-superficie p-4.5 ${
                i === 0 ? "border-amber-500/32" : "border-linea"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-texto">
                    {f.corredor}
                    {f.dorsal && <span className="ml-2 text-sm text-mudo">#{f.dorsal}</span>}
                  </p>
                  <p className="text-sm text-atenuado">
                    {f.eventoNombre} · {METODO_PAGO_LABEL[f.metodo]}
                    {f.referencia_externa && ` · Ref. ${f.referencia_externa}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-texto">
                    {formatPrecio(Number(f.monto), f.moneda)}
                  </p>
                  <Chip tono={ESTADO_PAGO_TONO[f.estado]}>{ESTADO_PAGO_LABEL[f.estado]}</Chip>
                </div>
              </div>

              {urlsComprobante.has(f.id) && (
                <a
                  href={urlsComprobante.get(f.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-start text-sm underline underline-offset-2 text-atenuado hover:text-texto"
                >
                  Ver comprobante
                </a>
              )}

              <div className="flex flex-wrap items-end gap-2 border-t pt-3 border-linea">
                <form action={cambiarEstadoPago.bind(null, f.id, "pagado")}>
                  {/* Solo el primero de la cola lleva naranja: con ocho
                      comprobantes, ocho botones naranja no señalan ninguno. */}
                  <Boton variante={i === 0 ? "primaria" : "secundaria"}>Aprobar</Boton>
                </form>
                <form action={cambiarEstadoPago.bind(null, f.id, "rechazado")} className="flex items-end gap-2">
                  {/* El motivo es obligatorio: le llega al corredor, y un
                      rechazo sin explicación genera una consulta por WhatsApp. */}
                  <input
                    name="notas"
                    required
                    placeholder="Motivo del rechazo"
                    className={`${CLASE_CAMPO} sm:w-64`}
                  />
                  <Boton variante="peligro" className="whitespace-nowrap">
                    Rechazar
                  </Boton>
                </form>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm border-linea-fuerte text-atenuado">
            No hay pagos pendientes de verificar.
          </p>
        )}
      </section>

      {/* Cobro fuera de la plataforma */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <EtiquetaMono>Registrar un cobro</EtiquetaMono>
          <p className="text-sm text-atenuado">
            Para el dinero que no pasó por aquí: efectivo en el mostrador o una transferencia que
            ya diste por buena. Entra como cobrado y el dorsal se asigna solo.
          </p>
        </div>
        <RegistrarPagoForm inscripciones={porCobrar} destacado={porVerificar.length === 0} />
      </section>

      {/* Histórico */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-texto">Todos los pagos</h2>
        {filas.length ? (
          <div className="overflow-x-auto rounded-2xl border border-linea">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead className="text-xs uppercase tracking-wide bg-superficie text-atenuado">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Corredor</th>
                  <th className="px-4 py-3">Evento</th>
                  <th className="px-4 py-3">Método</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {filas.map((f) => (
                  <tr key={f.id} className="bg-superficie/40">
                    <td className="px-4 py-3 text-xs text-atenuado">
                      {formatFechaCorta(f.created_at)}
                    </td>
                    <td className="px-4 py-3 text-texto">{f.corredor}</td>
                    <td className="px-4 py-3 text-atenuado">{f.eventoNombre}</td>
                    <td className="px-4 py-3 text-atenuado">{METODO_PAGO_LABEL[f.metodo]}</td>
                    <td className="px-4 py-3 font-medium tabular-nums text-texto">
                      {formatPrecio(Number(f.monto), f.moneda)}
                    </td>
                    <td className="px-4 py-3">
                      <Chip tono={ESTADO_PAGO_TONO[f.estado]}>{ESTADO_PAGO_LABEL[f.estado]}</Chip>
                    </td>
                    <td className="px-4 py-3">
                      {f.estado === "pagado" && (
                        <form action={cambiarEstadoPago.bind(null, f.id, "reembolsado")}>
                          <button className="text-xs text-mudo underline underline-offset-2 hover:text-texto">
                            Marcar reembolsado
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm border-linea-fuerte text-atenuado">
            Todavía no hay pagos registrados.{" "}
            <Link href="/panel/eventos" className="underline underline-offset-2">
              Ver eventos
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
