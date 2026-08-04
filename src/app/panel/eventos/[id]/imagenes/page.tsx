import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { prefijoEvento } from "@/lib/storage/rutas";
import { GestorImagenes } from "./GestorImagenes";

export const dynamic = "force-dynamic";

export default async function ImagenesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membresia = await getEmpresaActivaDelPanel();
  if (membresia.rol !== "admin_empresa") redirect(`/panel/eventos/${id}`);

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("id, imagen_banner_url")
    .eq("id", id)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) notFound();

  const { data: galeria } = await supabase
    .from("evento_imagenes")
    .select("id, url")
    .eq("evento_id", id)
    .order("orden");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-texto">Imágenes</h2>
        <p className="text-sm text-atenuado">
          Las imágenes se comprimen en tu navegador antes de subirse, así que puedes usar fotos
          tomadas con el móvil sin preocuparte por el peso.
        </p>
      </div>

      <GestorImagenes
        eventoId={evento.id}
        carpeta={prefijoEvento(membresia.empresaId, evento.id)}
        banner={evento.imagen_banner_url}
        galeria={galeria ?? []}
      />
    </div>
  );
}
