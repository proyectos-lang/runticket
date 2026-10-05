import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { InformeInscritos } from "@/components/modulos/InformeInscritos";
import { Aviso } from "@/components/ui/Aviso";

/**
 * El mismo informe que `/panel/inscritos`, acotado a esta carrera.
 *
 * Comparten componente a propósito: eran dos tablas distintas y la de aquí se
 * quedaba atrás cada vez que se tocaba la otra.
 */
export default async function InscritosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const filtros = await searchParams;
  const membresia = await getEmpresaActivaDelPanel();
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select("id, nombre")
    .eq("id", id)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) notFound();

  // Confirmaciones con las que vuelven «Inscribir en mesa» y «Transferir». No son
  // filtros: se sacan antes de armar la consulta, o acababan pegados al enlace
  // de exportación.
  const { nuevo, transferida, ...soloFiltros } = filtros;
  const consulta = new URLSearchParams(
    Object.entries(soloFiltros).filter(([, v]) => Boolean(v)) as [string, string][]
  );

  return (
    <div className="flex flex-col gap-6">
      {nuevo && (
        <Aviso tono="cian" titulo="Inscripción registrada">
          La persona ya figura en el padrón con su dorsal.
        </Aviso>
      )}
      {transferida && (
        <Aviso tono="cian" titulo="Transferencia hecha">
          La inscripción pasó a la nueva persona; la anterior queda como transferida.
        </Aviso>
      )}
      <div>
        {/* La vuelta la pone la cabecera del evento, común a todas sus
            pantallas: aquí duplicaba el enlace. */}
        <h1 className="text-2xl font-semibold text-texto">Inscritos</h1>
        <p className="text-sm text-atenuado">{evento.nombre}</p>
      </div>

      <InformeInscritos
        eventoId={evento.id}
        params={consulta}
        basePath={`/panel/eventos/${evento.id}/inscritos`}
      />
    </div>
  );
}
