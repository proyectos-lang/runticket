import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { InformeInscritos } from "@/components/modulos/InformeInscritos";

export const dynamic = "force-dynamic";

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

  const consulta = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => Boolean(v)) as [string, string][]
  );

  return (
    <div className="flex flex-col gap-6">
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
