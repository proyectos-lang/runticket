import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { ESTADO_EVENTO } from "@/lib/estados";
import { ChipEstado } from "@/components/ui/Chip";
import { VolverDeEvento } from "./VolverDeEvento";
import { PasosCarrera } from "./PasosCarrera";

/**
 * Guarda y cabecera comunes a todas las pantallas de un evento. Antes cada
 * subpágina volvía a cargar el evento solo para pintar su nombre.
 */
export default async function EventoLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const membresia = await getEmpresaActivaDelPanel();
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select("id, nombre, slug, estado")
    .eq("id", id)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-5 border-linea">
        <div className="min-w-0">
          <VolverDeEvento eventoId={evento.id} />
          <h1 className="mt-1 truncate text-2xl font-semibold text-texto">
            {evento.nombre}
          </h1>
          <p className="truncate text-sm text-atenuado">/eventos/{evento.slug}</p>
        </div>
        <div className="flex items-center gap-3">
          <ChipEstado estilo={ESTADO_EVENTO[evento.estado]} />
          {evento.estado !== "borrador" && (
            <Link
              href={`/eventos/${evento.slug}`}
              target="_blank"
              className="text-sm text-mudo underline-offset-2 hover:underline hover:text-texto"
            >
              Ver página pública
            </Link>
          )}
        </div>
      </header>

      {children}

      {/* Se renderiza a sí mismo solo en las pantallas de configuración. */}
      <PasosCarrera eventoId={evento.id} />
    </div>
  );
}
