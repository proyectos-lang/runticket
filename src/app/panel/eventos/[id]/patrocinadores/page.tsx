import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { prefijoEvento } from "@/lib/storage/rutas";
import { GestorPatrocinadores } from "./GestorPatrocinadores";

export const dynamic = "force-dynamic";

export default async function PatrocinadoresPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: patrocinadores } = await supabase
    .from("patrocinadores")
    .select("id, nombre, logo_url, url_sitio")
    .eq("evento_id", id)
    .order("orden");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-texto">Patrocinadores</h2>
        <p className="text-sm text-atenuado">
          Aparecen en la página pública del evento, al pie del dorsal y en el certificado de
          participación, en el orden que fijes aquí.
        </p>
      </div>

      <GestorPatrocinadores
        eventoId={id}
        carpeta={prefijoEvento(membresia.empresaId, id)}
        patrocinadores={patrocinadores ?? []}
      />
    </div>
  );
}
