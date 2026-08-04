import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { ModuloInventario } from "@/components/modulos/ModuloInventario";

export const dynamic = "force-dynamic";

export default async function TallasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membresia = await getEmpresaActivaDelPanel();
  if (membresia.rol !== "admin_empresa") redirect(`/panel/eventos/${id}`);

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
        <h2 className="text-lg font-semibold text-texto">
          Tallas e inventario
        </h2>
        <p className="text-sm text-atenuado">
          Las tallas agotadas dejan de ofrecerse automáticamente en el formulario de inscripción.
        </p>
      </div>

      <ModuloInventario eventoId={id} />
    </div>
  );
}
