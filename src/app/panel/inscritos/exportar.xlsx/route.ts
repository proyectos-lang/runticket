import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { contextoModulo } from "@/lib/panel/contexto";
import { listarInscritos, filtrosDeParams } from "@/lib/eventos/inscritos";
import { excelDeInscritos } from "@/lib/eventos/excelInscritos";
import { respuestaExcel } from "@/lib/excel";

/**
 * El informe de inscritos en Excel, con el mismo alcance y los mismos filtros
 * que la pantalla de la que se descarga: se leen de la misma querystring con la
 * misma función. Si divergieran, el archivo no se correspondería con la tabla
 * que el usuario está mirando.
 */
export async function GET(request: Request) {
  const membresia = await getEmpresaActivaDelPanel();
  const params = new URL(request.url).searchParams;

  // El mismo contexto que la pantalla: respeta `?evento=` y la carrera recordada.
  const { eventoId, evento } = await contextoModulo(params.get("evento") ?? undefined, {
    permitirTodos: true,
  });

  const puedeVerPagos = membresia.rol === "admin_empresa";
  const { filas, categorias } = await listarInscritos(
    eventoId,
    filtrosDeParams(params),
    puedeVerPagos
  );

  const titulo = evento ? `Inscritos · ${evento.nombre}` : `Inscritos · ${membresia.nombreComercial}`;
  const libro = await excelDeInscritos(filas, categorias, {
    incluirPagos: puedeVerPagos,
    titulo,
    todasLasCarreras: eventoId === null,
  });

  const sufijo = evento ? evento.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "todas";
  return respuestaExcel(`inscritos-${sufijo}.xlsx`, libro);
}
