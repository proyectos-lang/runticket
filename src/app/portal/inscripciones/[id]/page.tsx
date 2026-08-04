import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatFechaHora } from "@/lib/format";
import { enlaceWhatsApp } from "@/lib/pagos";
import { puntosDeEntrega } from "@/lib/eventos/consultas";
import { TarjetaDorsal } from "@/components/portal/TarjetaDorsal";
import { EtiquetaMono } from "@/components/ui/Datos";
import { BotonEnlace } from "@/components/ui/Boton";
import { Chip } from "@/components/ui/Chip";
import { SeccionPago } from "./SeccionPago";
import { CambiarTalla } from "./CambiarTalla";

export const dynamic = "force-dynamic";

export default async function InscripcionDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nueva?: string }>;
}) {
  const { id } = await params;
  const { nueva } = await searchParams;
  const supabase = await createClient();

  const { data: inscripcion } = await supabase.from("inscripciones").select("*").eq("id", id).maybeSingle();
  if (!inscripcion) notFound();

  const [{ data: evento }, { data: categoria }, { data: firma }, { data: pago }, { data: empresa }, { data: perfil }] =
    await Promise.all([
      supabase
        .from("eventos")
        .select("id, nombre, slug, fecha_inicio, direccion, zona_horaria, estado, kit_contenido")
        .eq("id", inscripcion.evento_id)
        .single(),
      supabase.from("categorias").select("nombre").eq("id", inscripcion.categoria_id).single(),
      supabase
        .from("inscripcion_firmas")
        .select("pdf_url, firmado_en")
        .eq("inscripcion_id", id)
        .maybeSingle(),
      supabase
        .from("pagos")
        .select("estado, metodo, referencia_externa, notas, comprobante_url, verificado_en")
        .eq("inscripcion_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("empresas")
        .select("nombre_comercial, telefono_contacto")
        .eq("id", inscripcion.empresa_id)
        .maybeSingle(),
      supabase.from("perfiles").select("nombres, apellidos").eq("id", inscripcion.corredor_id).single(),
    ]);

  const entregas = await puntosDeEntrega(inscripcion.evento_id);

  // Un pago resuelto (confirmado o sin importe) libera el naranja de la pantalla
  // para el CTA de retiro del kit; ver el comentario de SeccionPago.
  const pagoResuelto = pago?.estado === "pagado" || Number(inscripcion.precio_pagado) === 0;

  const { data: tallas } = await supabase
    .from("evento_tallas")
    .select("talla, inventario_disponible")
    .eq("evento_id", inscripcion.evento_id)
    .order("talla");

  // Mismas condiciones que valida la función en la base de datos, para no
  // ofrecer un formulario que va a fallar.
  const puedeCambiarTalla =
    inscripcion.estado === "activa" &&
    !inscripcion.kit_entregado &&
    evento?.estado !== "finalizado" &&
    evento?.estado !== "cancelado" &&
    (tallas?.length ?? 0) > 0;

  // Los buckets son privados: se firman URLs temporales para descargar.
  const admin = createAdminClient();
  let urlDeclaracion: string | null = null;
  if (firma?.pdf_url) {
    const { data } = await admin.storage.from("declaraciones").createSignedUrl(firma.pdf_url, 60 * 10);
    urlDeclaracion = data?.signedUrl ?? null;
  }
  let urlComprobante: string | null = null;
  if (pago?.comprobante_url) {
    const { data } = await admin.storage.from("comprobantes").createSignedUrl(pago.comprobante_url, 60 * 10);
    urlComprobante = data?.signedUrl ?? null;
  }

  const nombreCorredor = `${perfil?.nombres ?? ""} ${perfil?.apellidos ?? ""}`.trim();
  const enlaceWa =
    empresa?.telefono_contacto && evento
      ? enlaceWhatsApp({
          telefonoOrganizador: empresa.telefono_contacto,
          inscripcionId: inscripcion.id,
          corredor: nombreCorredor,
          evento: evento.nombre,
          categoria: categoria?.nombre ?? "",
          monto: Number(inscripcion.precio_pagado),
          moneda: inscripcion.moneda,
        })
      : null;

  return (
    <div className="flex flex-col gap-6">
      {nueva && (
        <div className="relative overflow-hidden rounded-2xl border border-linea px-6 py-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 -top-40 size-[28.75rem] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(255,106,26,.28), transparent 68%)" }}
          />
          <div className="relative flex flex-col gap-3">
            <span className="flex size-14 items-center justify-center rounded-full bg-naranja text-2xl text-tinta">
              ✓
            </span>
            <h1 className="display text-3xl text-texto">Estás inscrito</h1>
            <p className="max-w-md text-sm text-atenuado">
              El organizador te contactará para coordinar el pago. Tu dorsal se asigna en cuanto lo
              confirme.
            </p>
          </div>
        </div>
      )}

      <Link
        href="/portal"
        className="font-mono text-xs uppercase tracking-etiqueta text-mudo transition-colors hover:text-texto"
      >
        ← Mis inscripciones
      </Link>

      {inscripcion.numero_dorsal !== null && inscripcion.codigo_qr && evento && (
        <TarjetaDorsal
          numeroDorsal={inscripcion.numero_dorsal}
          codigoQr={inscripcion.codigo_qr}
          eventoId={inscripcion.evento_id}
          evento={evento.nombre}
          categoria={categoria?.nombre ?? ""}
          talla={inscripcion.talla}
        />
      )}

      <div className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
        <div className="flex items-start justify-between gap-4 border-b pb-4 border-linea">
          <div>
            <h1 className="text-xl font-semibold text-texto">{evento?.nombre}</h1>
            <p className="text-sm text-atenuado">
              {evento && formatFechaHora(evento.fecha_inicio, evento.zona_horaria)}
            </p>
            {evento?.direccion && (
              <p className="text-sm text-atenuado">{evento.direccion}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-atenuado">Dorsal</p>
            <p className="text-3xl font-bold text-texto">
              {inscripcion.numero_dorsal ?? "—"}
            </p>
          </div>
        </div>

        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-atenuado">Categoría</dt>
            <dd className="text-texto">{categoria?.nombre}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-atenuado">Inscripción</dt>
            <dd className="capitalize text-texto">{inscripcion.estado}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-atenuado">Referencia</dt>
            <dd className="font-mono text-xs text-atenuado">{inscripcion.id}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-atenuado">Kit</dt>
            <dd className="text-texto">
              {inscripcion.kit_entregado ? "Entregado" : "Pendiente de retirar"}
            </dd>
          </div>
        </dl>

        {puedeCambiarTalla ? (
          <div className="border-t pt-4 border-linea">
            <CambiarTalla
              inscripcionId={inscripcion.id}
              tallaActual={inscripcion.talla}
              tallas={tallas ?? []}
            />
          </div>
        ) : (
          <div className="border-t pt-4 border-linea">
            <p className="text-xs uppercase tracking-wide text-atenuado">Talla de camiseta</p>
            <p className="text-texto">{inscripcion.talla ?? "Sin talla"}</p>
            {inscripcion.kit_entregado && (
              <p className="mt-1 text-xs text-atenuado">
                Tu kit ya fue entregado; para cambiar la talla habla con el organizador.
              </p>
            )}
          </div>
        )}

        {!inscripcion.kit_entregado && inscripcion.numero_dorsal !== null && inscripcion.codigo_qr && (
          <div className="border-t border-linea pt-4">
            <BotonEnlace
              href={`/portal/inscripciones/${inscripcion.id}/kit`}
              variante={pagoResuelto ? "primaria" : "secundaria"}
              ancho
            >
              Ver mi código de retiro
            </BotonEnlace>
          </div>
        )}

        {!inscripcion.kit_entregado && (entregas.length > 0 || (evento?.kit_contenido?.length ?? 0) > 0) && (
          <div className="flex flex-col gap-4 border-t border-linea pt-4">
            {entregas.length > 0 && (
              <div className="flex flex-col gap-2">
                <EtiquetaMono>Dónde y cuándo recoger tu kit</EtiquetaMono>
                {entregas.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-linea bg-superficie-2 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-texto">{p.nombre}</p>
                      {p.direccion && <p className="text-sm text-atenuado">{p.direccion}</p>}
                      {p.horario && (
                        <Chip tono="info" className="mt-1.5">
                          {p.horario}
                        </Chip>
                      )}
                    </div>
                    {p.lat !== null && p.lng !== null && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs uppercase tracking-etiqueta text-cian hover:text-texto"
                      >
                        Abrir en mapas →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {(evento?.kit_contenido?.length ?? 0) > 0 && (
              <div className="flex flex-col gap-2">
                <EtiquetaMono>Tu kit incluye</EtiquetaMono>
                <ol className="flex flex-col gap-1.5">
                  {evento!.kit_contenido.map((item: string, i: number) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-texto">
                      <span className="tabular font-mono text-sm font-bold text-naranja">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <p className="rounded-xl border border-azul/28 bg-azul/8 px-4 py-3 text-sm text-azul-suave">
              Puedes autorizar a otra persona a retirar tu kit: basta con que enseñe este código
              junto a su documento de identidad.
            </p>
          </div>
        )}

        <div className="border-t pt-4 border-linea">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-atenuado">
            Documentos
          </p>
          {urlDeclaracion ? (
            <a
              href={urlDeclaracion}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline underline-offset-2 text-atenuado hover:text-texto"
            >
              Descargar declaración de salud firmada (PDF)
            </a>
          ) : (
            <p className="text-sm text-atenuado">
              La declaración firmada aún se está generando.
            </p>
          )}

          <div className="mt-3 flex flex-col gap-2">
            {inscripcion.numero_dorsal ? (
              <a
                href={`/portal/inscripciones/${inscripcion.id}/dorsal.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline underline-offset-2 text-atenuado hover:text-texto"
              >
                Descargar mi dorsal con QR (PDF)
              </a>
            ) : (
              <p className="text-sm text-atenuado">
                Tu dorsal se genera cuando el organizador confirma el pago.
              </p>
            )}

            {evento?.estado === "finalizado" && (
              <a
                href={`/portal/inscripciones/${inscripcion.id}/certificado.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline underline-offset-2 text-atenuado hover:text-texto"
              >
                Descargar mi certificado de participación (PDF)
              </a>
            )}
          </div>
        </div>
      </div>

      {Number(inscripcion.precio_pagado) > 0 && inscripcion.estado === "activa" && (
        <SeccionPago
          verificadoEn={pago?.verificado_en ?? null}
          inscripcionId={inscripcion.id}
          monto={Number(inscripcion.precio_pagado)}
          moneda={inscripcion.moneda}
          pago={pago}
          enlaceWa={enlaceWa}
          urlComprobante={urlComprobante}
        />
      )}
    </div>
  );
}
