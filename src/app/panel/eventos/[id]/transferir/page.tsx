import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { obtenerDeclaracionVigente } from "@/lib/declaraciones";
import { EstadoVacio } from "@/components/panel/EstadoVacio";
import { TransferirForm } from "./TransferirForm";

export const dynamic = "force-dynamic";

export default async function TransferirPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membresia = await getEmpresaActivaDelPanel();
  if (membresia.rol !== "admin_empresa") redirect(`/panel/eventos/${id}`);

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("id, empresa_id")
    .eq("id", id)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) notFound();

  const [{ data: inscripciones }, { data: categorias }, declaracion] = await Promise.all([
    supabase
      .from("inscripciones")
      .select("id, corredor_id, categoria_id, numero_dorsal")
      .eq("evento_id", id)
      .eq("estado", "activa")
      .order("numero_dorsal", { nullsFirst: false }),
    supabase.from("categorias").select("id, nombre").eq("evento_id", id),
    obtenerDeclaracionVigente(evento.empresa_id, evento.id),
  ]);

  const { data: perfiles } = inscripciones?.length
    ? await supabase
        .from("perfiles")
        .select("id, nombres, apellidos, correo")
        .in("id", [...new Set(inscripciones.map((i) => i.corredor_id))])
    : { data: [] as never[] };

  const opciones = (inscripciones ?? []).map((i) => {
    const p = perfiles?.find((x) => x.id === i.corredor_id);
    const nombre = [p?.nombres, p?.apellidos].filter(Boolean).join(" ") || p?.correo || "—";
    const cat = categorias?.find((c) => c.id === i.categoria_id)?.nombre ?? "";
    return {
      id: i.id,
      etiqueta: `${i.numero_dorsal ? `#${i.numero_dorsal} · ` : ""}${nombre} · ${cat}`,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-texto">
          Transferir inscripción
        </h2>
        <p className="max-w-2xl text-sm text-atenuado">
          Para cuando alguien no puede correr y cede su plaza. Se hace con las dos partes presentes:
          quien recibe la inscripción tiene que firmar su propia declaración de salud.
        </p>
      </div>

      {opciones.length ? (
        <TransferirForm eventoId={id} inscripciones={opciones} declaracion={declaracion} />
      ) : (
        <EstadoVacio
          icono="inscritos"
          titulo="No hay inscripciones activas"
          descripcion="Solo se pueden transferir inscripciones activas. Cuando haya corredores apuntados podrás cederle la plaza de uno a otra persona."
        />
      )}
    </div>
  );
}
