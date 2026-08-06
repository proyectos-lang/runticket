import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { puntosDeEntrega } from "@/lib/eventos/consultas";
import { formatFechaHora, diasHasta } from "@/lib/format";
import { TarjetaCodigoRetiro } from "@/components/portal/TarjetaCodigoRetiro";
import { PantallaDespierta } from "@/components/portal/PantallaDespierta";
import { CompartirRetiro } from "@/components/portal/CompartirRetiro";
import { ChipHorario, horarioEsHoy } from "@/components/portal/ChipHorario";
import { EtiquetaMono, PlaceholderMedia } from "@/components/ui/Datos";
import { claseBoton } from "@/components/ui/estilosBoton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entrega de kit | RunTicket",
  robots: { index: false },
};

export default async function KitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: inscripcion } = await supabase
    .from("inscripciones")
    .select(
      "id, evento_id, categoria_id, numero_dorsal, codigo_qr, talla, estado, kit_entregado, kit_entregado_en"
    )
    .eq("id", id)
    .maybeSingle();
  if (!inscripcion) notFound();

  // Sin dorsal no hay código que enseñar: la ficha explica qué falta.
  if (inscripcion.numero_dorsal === null || !inscripcion.codigo_qr) {
    redirect(`/portal/inscripciones/${id}`);
  }

  const [{ data: evento }, { data: categoria }, entregas] = await Promise.all([
    supabase
      .from("eventos")
      .select("id, nombre, fecha_inicio, zona_horaria, kit_contenido")
      .eq("id", inscripcion.evento_id)
      .single(),
    supabase
      .from("categorias")
      .select("nombre, distancia_km")
      .eq("id", inscripcion.categoria_id)
      .single(),
    puntosDeEntrega(inscripcion.evento_id),
  ]);

  const retirado = inscripcion.kit_entregado;
  const kit = evento?.kit_contenido ?? [];

  // Sin puntos de entrega declarados, la logística es la del propio evento.
  const diasParaLaCarrera = evento ? diasHasta(evento.fecha_inicio) : 0;

  const textoParaDelegar = [
    `Retiro de kit · ${evento?.nombre ?? ""}`,
    `Código: RT-${inscripcion.numero_dorsal}`,
    `Dorsal: ${inscripcion.numero_dorsal}`,
    inscripcion.talla ? `Talla: ${inscripcion.talla}` : null,
    entregas[0]?.nombre ? `Punto: ${entregas[0].nombre}` : null,
    entregas[0]?.direccion ?? null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="flex flex-col gap-6">
      {/* Mientras el código está a la vista, la pantalla no se apaga. */}
      {!retirado && <PantallaDespierta />}

      <div className="flex items-center gap-3">
        <Link
          href={`/portal/inscripciones/${id}`}
          aria-label="Volver a la inscripción"
          className="text-lg font-bold text-texto"
        >
          ‹
        </Link>
        <EtiquetaMono>Entrega de kit</EtiquetaMono>
      </div>

      <h1 className="display text-3xl text-texto">
        {retirado ? "Kit retirado" : "Recoge tu kit y dorsal"}
      </h1>

      <TarjetaCodigoRetiro
        eventoId={inscripcion.evento_id}
        codigoQr={inscripcion.codigo_qr}
        dorsal={inscripcion.numero_dorsal}
        talla={inscripcion.talla}
        categoria={categoria?.nombre ?? ""}
        distanciaKm={categoria?.distancia_km ?? null}
        estado={retirado ? "retirado" : "listo"}
        retiradoEn={inscripcion.kit_entregado_en}
      />

      {/* Ya retirado, la logística sobra: se ocultan puntos y delegación. */}
      {!retirado && (
        <>
          <section className="flex flex-col gap-3">
            <EtiquetaMono>Dónde y cuándo</EtiquetaMono>

            {entregas.length ? (
              entregas.map((p, i) => (
                <div
                  key={p.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-linea bg-superficie"
                >
                  <PlaceholderMedia
                    etiqueta="mapa del punto de entrega"
                    variante="fria"
                    className="h-30 w-full"
                  />
                  <div className="flex flex-col gap-2 p-4">
                    <p className="font-bold text-texto">{p.nombre}</p>
                    {p.direccion && (
                      <p className="text-[0.75rem] leading-relaxed text-texto/50">{p.direccion}</p>
                    )}
                    {p.horario && (
                      <ChipHorario texto={p.horario} esHoy={horarioEsHoy(p.horario)} />
                    )}
                    {p.lat !== null && p.lng !== null && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={claseBoton(i === 0 ? "primaria" : "secundaria", "md", "mt-2 w-full")}
                      >
                        Abrir en mapas
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-linea bg-superficie px-4 py-4">
                <p className="text-sm text-atenuado">
                  El organizador todavía no publicó los puntos de entrega.
                  {evento && diasParaLaCarrera >= 0 && (
                    <>
                      {" "}
                      La carrera es el{" "}
                      <span className="text-texto">
                        {formatFechaHora(evento.fecha_inicio, evento.zona_horaria)}
                      </span>
                      .
                    </>
                  )}
                </p>
              </div>
            )}
          </section>

          {kit.length > 0 && (
            <section className="flex flex-col gap-2">
              <EtiquetaMono>Tu kit incluye</EtiquetaMono>
              {kit.map((item: string, i: number) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-lg border border-linea bg-superficie px-3.5 py-3"
                >
                  <span className="tabular font-mono text-sm font-bold text-naranja">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[0.8125rem] text-texto/75">{item}</span>
                </div>
              ))}
            </section>
          )}

          <p className="rounded-lg border border-azul/28 bg-azul/8 px-4 py-3.5 text-[0.75rem] leading-relaxed text-azul-suave">
            Puede retirarlo otra persona en tu nombre{" "}
            <CompartirRetiro texto={textoParaDelegar} />, junto con su documento de identidad.
          </p>
        </>
      )}
    </div>
  );
}
