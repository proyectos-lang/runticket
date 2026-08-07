import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatFechaHora, formatPrecio, formatDistancia } from "@/lib/format";
import { enlaceWhatsApp } from "@/lib/pagos";
import { EtiquetaMono } from "@/components/ui/Datos";
import { Aviso } from "@/components/ui/Aviso";
import { BotonEnlace } from "@/components/ui/Boton";
import { SeccionPago } from "@/app/portal/inscripciones/[id]/SeccionPago";
import { subirComprobanteGrupo, marcarPagoGrupoPorWhatsApp } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi grupo | RunTicket",
  robots: { index: false },
};

/**
 * La inscripción de una familia, en una sola pantalla.
 *
 * Antes cada persona tenía su ficha suelta y su propio cobro: el titular saltaba
 * entre pantallas para ver los dorsales de sus hijos y mandaba un comprobante
 * por cada uno. Aquí está el pago único y, cuando el organizador lo confirma, el
 * dorsal y el código de retiro de todos.
 */
export default async function GrupoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nueva?: string; aviso?: string }>;
}) {
  const { id } = await params;
  const { nueva, aviso } = await searchParams;
  const supabase = await createClient();

  // La RLS de `grupos_inscripcion` solo deja ver los que uno paga.
  const { data: grupo } = await supabase
    .from("grupos_inscripcion")
    .select("id, evento_id, empresa_id, pagador_id")
    .eq("id", id)
    .maybeSingle();
  if (!grupo) notFound();

  const [{ data: personas }, { data: evento }, { data: empresa }, { data: pago }, { data: perfil }] =
    await Promise.all([
      // Por RPC: `perfiles` solo deja leer la fila propia y la de quien sigue en
      // tu lista de acompañantes, así que quitar a alguien de la lista borraría
      // su nombre de una carrera ya pagada.
      supabase.rpc("personas_de_grupo", { p_grupo_id: id }),
      supabase
        .from("eventos")
        .select("id, nombre, slug, fecha_inicio, zona_horaria, estado, moneda")
        .eq("id", grupo.evento_id)
        .maybeSingle(),
      supabase
        .from("empresas")
        .select("nombre_comercial, telefono_contacto")
        .eq("id", grupo.empresa_id)
        .maybeSingle(),
      supabase
        .from("pagos")
        .select("estado, metodo, referencia_externa, notas, comprobante_url, verificado_en, monto, moneda")
        .eq("grupo_inscripcion_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("perfiles").select("nombres, apellidos").eq("id", grupo.pagador_id).single(),
    ]);

  const gente = personas ?? [];
  if (gente.length === 0) notFound();

  const total = gente.reduce((a, p) => a + Number(p.precio_pagado), 0);
  // La del evento manda mientras no haya pago: dar por hecho «HNL» mostraría un
  // símbolo equivocado en una carrera que cobre en otra moneda.
  const moneda = pago?.moneda ?? evento?.moneda ?? "HNL";
  const pagado = pago?.estado === "pagado";
  const conDorsal = gente.filter((p) => p.numero_dorsal !== null).length;

  // El comprobante vive en un bucket privado: se firma para poder enseñarlo.
  let urlComprobante: string | null = null;
  if (pago?.comprobante_url) {
    const { data } = await createAdminClient()
      .storage.from("comprobantes")
      .createSignedUrl(pago.comprobante_url, 600);
    urlComprobante = data?.signedUrl ?? null;
  }

  const nombrePagador = `${perfil?.nombres ?? ""} ${perfil?.apellidos ?? ""}`.trim();
  const enlaceWa =
    empresa?.telefono_contacto && evento
      ? enlaceWhatsApp({
          telefonoOrganizador: empresa.telefono_contacto,
          referencia: grupo.id,
          corredor: nombrePagador,
          evento: evento.nombre,
          personas: gente.length,
          monto: total,
          moneda,
        })
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/portal/inscripciones"
          className="font-mono text-xs uppercase tracking-etiqueta text-mudo transition-colors hover:text-texto"
        >
          ← Mis inscripciones
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-texto">{evento?.nombre}</h1>
        <p className="text-sm text-atenuado">
          {evento && formatFechaHora(evento.fecha_inicio, evento.zona_horaria)} ·{" "}
          {gente.length} {gente.length === 1 ? "persona" : "personas"}
        </p>
      </div>

      {nueva && (
        <Aviso tono="cian" titulo="Inscripción completada">
          Quedaron dentro {gente.length} {gente.length === 1 ? "persona" : "personas"}. Abajo
          tienes el pago, que cubre a todas.
        </Aviso>
      )}
      {aviso && (
        <Aviso tono="ambar" titulo="Atención">
          {aviso}
        </Aviso>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <EtiquetaMono>Quiénes corren</EtiquetaMono>
          {pagado && (
            <span className="font-mono text-[0.65625rem] uppercase tracking-etiqueta text-mudo">
              {conDorsal} de {gente.length} con dorsal
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          {gente.map((p) => (
            <div
              key={p.inscripcion_id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4 border-linea bg-superficie"
            >
              <div className="flex min-w-0 items-center gap-4">
                <span
                  className={`tabular w-14 shrink-0 text-center font-mono text-lg font-extrabold ${
                    p.numero_dorsal !== null ? "text-naranja" : "text-texto/25"
                  }`}
                >
                  {p.numero_dorsal ?? "—"}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="truncate font-semibold text-texto">
                    {p.nombre ?? "Sin nombre"}
                    {p.es_titular && <span className="ml-2 text-xs text-mudo">(tú)</span>}
                  </p>
                  <p className="truncate font-mono text-[0.65625rem] uppercase tracking-etiqueta text-texto/45">
                    {[
                      p.categoria,
                      p.distancia_km !== null && formatDistancia(Number(p.distancia_km)),
                      p.talla && `Talla ${p.talla}`,
                      p.kit_entregado && "Kit retirado",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span className="tabular font-mono text-sm text-atenuado">
                  {formatPrecio(Number(p.precio_pagado), moneda)}
                </span>
                {/* El dorsal y el QR viven en la ficha de cada persona; aquí
                    solo se enlaza para no repetir media pantalla por miembro. */}
                <BotonEnlace
                  href={`/portal/inscripciones/${p.inscripcion_id}`}
                  variante="secundaria"
                  tamano="sm"
                >
                  {p.numero_dorsal !== null ? "Ver dorsal" : "Ver ficha"}
                </BotonEnlace>
              </div>
            </div>
          ))}
        </div>
      </section>

      {total > 0 ? (
        <SeccionPago
          subir={subirComprobanteGrupo.bind(null, grupo.id)}
          registrarWhatsApp={marcarPagoGrupoPorWhatsApp.bind(null, grupo.id)}
          monto={pago ? Number(pago.monto) : total}
          moneda={moneda}
          pago={pago}
          enlaceWa={enlaceWa}
          urlComprobante={urlComprobante}
          verificadoEn={pago?.verificado_en ?? null}
          detalle={`${gente.length} ${gente.length === 1 ? "persona" : "personas"}`}
        />
      ) : (
        <Aviso tono="cian" titulo="Sin importe pendiente">
          Esta inscripción no tiene coste. Los dorsales se asignan solos.
        </Aviso>
      )}
    </div>
  );
}
