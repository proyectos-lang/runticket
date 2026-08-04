import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { listarInscritos } from "@/lib/eventos/inscritos";
import { construirCsv, respuestaCsv } from "@/lib/csv";
import { ESTADO_PAGO_LABEL, METODO_PAGO_LABEL } from "@/lib/pagos";
import type { EstadoPago, Sexo } from "@/lib/supabase/database.types";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membresia = await getEmpresaActivaDelPanel();
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select("id, nombre, slug")
    .eq("id", id)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) return new Response("Evento no encontrado", { status: 404 });

  const puedeVerPagos = membresia.rol === "admin_empresa";
  const q = new URL(request.url).searchParams;

  const { filas } = await listarInscritos(
    evento.id,
    {
      q: q.get("q") ?? undefined,
      categoriaId: q.get("categoria") ?? undefined,
      talla: q.get("talla") ?? undefined,
      sexo: (q.get("sexo") as Sexo) ?? undefined,
      estadoPago: (q.get("pago") as EstadoPago | "sin_pago") ?? undefined,
    },
    puedeVerPagos
  );

  const cabeceras = [
    "Dorsal",
    "Nombre",
    "Correo",
    "Teléfono",
    "Género",
    "Categoría",
    "Talla",
    "Kit entregado",
    "Fecha de inscripción",
    ...(puedeVerPagos ? ["Importe", "Moneda", "Estado del pago", "Método de pago", "Referencia"] : []),
  ];

  const datos = filas.map((f) => [
    f.numeroDorsal ?? "",
    f.nombre,
    f.correo ?? "",
    f.telefono ?? "",
    f.sexo ?? "",
    f.categoria,
    f.talla ?? "",
    f.kitEntregado ? "Sí" : "No",
    f.creadoEn.slice(0, 10),
    ...(puedeVerPagos
      ? [
          f.precio.toFixed(2),
          f.moneda,
          f.pago ? ESTADO_PAGO_LABEL[f.pago.estado] : "Sin registrar",
          f.pago ? METODO_PAGO_LABEL[f.pago.metodo] : "",
          f.pago?.referencia ?? "",
        ]
      : []),
  ]);

  return respuestaCsv(`inscritos-${evento.slug}.csv`, construirCsv(cabeceras, datos));
}
