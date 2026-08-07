import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { construirCsv, respuestaCsv } from "@/lib/csv";
import { ESTADO_PAGO_LABEL, METODO_PAGO_LABEL } from "@/lib/pagos";

export async function GET(request: Request) {
  const membresia = await getEmpresaActivaDelPanel();
  if (membresia.rol !== "admin_empresa") {
    return new Response("No autorizado", { status: 403 });
  }

  const eventoFiltro = new URL(request.url).searchParams.get("evento");
  const supabase = await createClient();

  const { data: pagos } = await supabase
    .from("pagos")
    .select(
      "id, inscripcion_id, grupo_inscripcion_id, monto, moneda, metodo, estado, referencia_externa, notas, created_at, verificado_en"
    )
    .eq("empresa_id", membresia.empresaId)
    .order("created_at", { ascending: false });

  const inscripcionIds = [...new Set((pagos ?? []).map((p) => p.inscripcion_id).filter(Boolean) as string[])];
  const { data: inscripciones } = inscripcionIds.length
    ? await supabase
        .from("inscripciones")
        .select("id, evento_id, corredor_id, numero_dorsal")
        .in("id", inscripcionIds)
    : { data: [] as never[] };

  // Un pago familiar cuelga de un grupo, no de una inscripción: sin esto salía
  // en la conciliación con el evento y el corredor en blanco.
  const grupoIds = [
    ...new Set((pagos ?? []).map((p) => p.grupo_inscripcion_id).filter(Boolean) as string[]),
  ];
  const { data: grupos } = grupoIds.length
    ? await supabase.from("grupos_inscripcion").select("id, evento_id, pagador_id").in("id", grupoIds)
    : { data: [] as { id: string; evento_id: string; pagador_id: string }[] };

  const personaIds = [
    ...new Set([
      ...(inscripciones ?? []).map((i) => i.corredor_id),
      ...(grupos ?? []).map((g) => g.pagador_id),
    ]),
  ];

  const [{ data: eventos }, { data: perfiles }] = await Promise.all([
    supabase.from("eventos").select("id, nombre, slug").eq("empresa_id", membresia.empresaId),
    personaIds.length
      ? supabase.from("perfiles").select("id, nombres, apellidos, correo").in("id", personaIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  let filas = (pagos ?? []).map((p) => {
    const grupo = p.grupo_inscripcion_id
      ? grupos?.find((g) => g.id === p.grupo_inscripcion_id)
      : undefined;
    const insc = inscripciones?.find((i) => i.id === p.inscripcion_id);
    const eventoId = grupo?.evento_id ?? insc?.evento_id ?? null;
    const perfil = perfiles?.find((x) => x.id === (grupo?.pagador_id ?? insc?.corredor_id));

    return {
      ...p,
      eventoId,
      eventoNombre: eventos?.find((e) => e.id === eventoId)?.nombre ?? "",
      dorsal: insc?.numero_dorsal ?? "",
      corredor:
        `${perfil?.nombres ?? ""} ${perfil?.apellidos ?? ""}`.trim() + (grupo ? " (grupo)" : ""),
      correo: perfil?.correo ?? "",
    };
  });

  if (eventoFiltro) filas = filas.filter((f) => f.eventoId === eventoFiltro);

  const cabeceras = [
    "Fecha de registro",
    "Fecha de confirmación",
    "Evento",
    "Dorsal",
    "Corredor",
    "Correo",
    "Monto",
    "Moneda",
    "Método",
    "Estado",
    "Referencia",
    "Notas",
  ];

  const datos = filas.map((f) => [
    f.created_at.slice(0, 10),
    f.verificado_en?.slice(0, 10) ?? "",
    f.eventoNombre,
    f.dorsal,
    f.corredor,
    f.correo,
    Number(f.monto).toFixed(2),
    f.moneda,
    METODO_PAGO_LABEL[f.metodo],
    ESTADO_PAGO_LABEL[f.estado],
    f.referencia_externa ?? "",
    f.notas ?? "",
  ]);

  const sufijo = eventoFiltro
    ? (eventos?.find((e) => e.id === eventoFiltro)?.slug ?? "evento")
    : "todos-los-eventos";

  return respuestaCsv(`pagos-${sufijo}.csv`, construirCsv(cabeceras, datos));
}
