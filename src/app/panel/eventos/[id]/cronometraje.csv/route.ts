import { createClient } from "@/lib/supabase/server";
import { requireMiembroDeEvento } from "@/lib/auth/session";
import { construirCsv, respuestaCsv } from "@/lib/csv";

/**
 * Padrón en el formato que piden las empresas de cronometraje: dorsal, nombre,
 * categoría y sexo, más una columna de chip que ellos rellenan.
 *
 * La vista es `security_invoker`, así que la RLS del usuario sigue aplicando: no
 * hace falta cliente admin.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireMiembroDeEvento(id);

  const supabase = await createClient();
  const [{ data: evento }, { data: filas }] = await Promise.all([
    supabase.from("eventos").select("slug").eq("id", id).maybeSingle(),
    supabase
      .from("vista_exportacion_cronometraje")
      .select("numero_dorsal, nombre_completo, categoria, sexo, chip")
      .eq("evento_id", id)
      .order("numero_dorsal"),
  ]);

  if (!evento) return new Response("Evento no encontrado", { status: 404 });

  const csv = construirCsv(
    ["Dorsal", "Nombre", "Categoría", "Sexo", "Chip"],
    (filas ?? []).map((f) => [
      f.numero_dorsal ?? "",
      f.nombre_completo,
      f.categoria,
      f.sexo ?? "",
      f.chip ?? "",
    ])
  );

  return respuestaCsv(`cronometraje-${evento.slug}.csv`, csv);
}
