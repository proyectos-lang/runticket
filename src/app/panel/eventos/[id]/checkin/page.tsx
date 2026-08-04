import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { ModuloCheckin } from "@/components/modulos/ModuloCheckin";

export const dynamic = "force-dynamic";

export default async function CheckinEventoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ codigo?: string }>;
}) {
  const { id } = await params;
  const { codigo } = await searchParams;
  const membresia = await getEmpresaActivaDelPanel();
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select("id")
    .eq("id", id)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-texto">Entrega de kits</h2>
        <p className="text-sm text-atenuado">
          Escanea el QR del dorsal, o busca por número si el corredor no trae el teléfono.
        </p>
      </div>

      <ModuloCheckin eventoId={id} codigoInicial={codigo} />
    </div>
  );
}
