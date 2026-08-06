import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { listarInscritos, filtrosDeParams } from "@/lib/eventos/inscritos";
import { excelDeInscritos } from "@/lib/eventos/excelInscritos";
import { respuestaExcel } from "@/lib/excel";

/** El informe de una carrera concreta, con los filtros activos en su pantalla. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const membresia = await getEmpresaActivaDelPanel();
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select("id, nombre, slug")
    .eq("id", id)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) return new Response("No encontrado", { status: 404 });

  const params = new URL(request.url).searchParams;
  const puedeVerPagos = membresia.rol === "admin_empresa";

  const { filas, categorias } = await listarInscritos(
    evento.id,
    filtrosDeParams(params),
    puedeVerPagos
  );

  const libro = await excelDeInscritos(filas, categorias, {
    incluirPagos: puedeVerPagos,
    titulo: `Inscritos · ${evento.nombre}`,
    todasLasCarreras: false,
  });

  return respuestaExcel(`inscritos-${evento.slug}.xlsx`, libro);
}
