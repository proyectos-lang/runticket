import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { UbicacionForm } from "./UbicacionForm";
import { GpxForm } from "./GpxForm";
import { GestorPuntosEntrega } from "./GestorPuntosEntrega";

export const dynamic = "force-dynamic";

export default async function UbicacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membresia = await getEmpresaActivaDelPanel();
  if (membresia.rol !== "admin_empresa") redirect(`/panel/eventos/${id}`);

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("id, direccion, lat, lng, punto_encuentro_lat, punto_encuentro_lng, ruta_gpx_url")
    .eq("id", id)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) notFound();

  const { data: puntos } = await supabase
    .from("evento_puntos_entrega")
    .select("id, nombre, direccion, horario, lat, lng")
    .eq("evento_id", id)
    .order("orden");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-texto">Ubicación y ruta</h2>
        <p className="text-sm text-atenuado">
          El mapa solo aparece en la página pública cuando hay coordenadas de salida y meta.
        </p>
      </div>

      <section className="rounded-2xl border p-6 border-linea bg-superficie">
        <UbicacionForm
          eventoId={evento.id}
          direccion={evento.direccion}
          lat={evento.lat === null ? null : Number(evento.lat)}
          lng={evento.lng === null ? null : Number(evento.lng)}
          puntoEncuentroLat={
            evento.punto_encuentro_lat === null ? null : Number(evento.punto_encuentro_lat)
          }
          puntoEncuentroLng={
            evento.punto_encuentro_lng === null ? null : Number(evento.punto_encuentro_lng)
          }
          ruta={[]}
        />
      </section>

      <section className="rounded-2xl border p-6 border-linea bg-superficie">
        <h3 className="mb-3 text-base font-semibold text-texto">
          Trazado del recorrido (GPX)
        </h3>
        <GpxForm eventoId={evento.id} rutaActual={evento.ruta_gpx_url} />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-texto">Puntos de retiro de kit</h3>
          <p className="text-sm text-atenuado">
            Dónde y cuándo puede recoger el corredor su dorsal y su prenda. Aparecen en su
            pantalla de kit y en la ficha pública del evento.
          </p>
        </div>
        <GestorPuntosEntrega eventoId={evento.id} puntos={puntos ?? []} />
      </section>
    </div>
  );
}
