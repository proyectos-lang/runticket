import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { listarInscritos } from "@/lib/eventos/inscritos";
import { formatPrecio, formatFechaCorta } from "@/lib/format";
import { ESTADO_PAGO_LABEL, ESTADO_PAGO_TONO } from "@/lib/pagos";
import { Chip } from "@/components/ui/Chip";
import type { EstadoPago, Sexo } from "@/lib/supabase/database.types";
import { FiltrosInscritos } from "./FiltrosInscritos";
import { AccionesInscrito } from "./AccionesInscrito";

export const dynamic = "force-dynamic";

const SEXO_CORTO: Record<Sexo, string> = { femenino: "F", masculino: "M", otro: "—" };

export default async function InscritosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; categoria?: string; talla?: string; sexo?: Sexo; pago?: string }>;
}) {
  const { id } = await params;
  const filtros = await searchParams;
  const membresia = await getEmpresaActivaDelPanel();
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select("id, nombre, slug")
    .eq("id", id)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) notFound();

  // El operador no tiene permiso de lectura sobre `pagos`: no se le muestra la
  // columna ni se intenta cargarla.
  const puedeVerPagos = membresia.rol === "admin_empresa";
  // Mover de categoría, cambiar talla o anular son decisiones del administrador,
  // no del operador que solo entrega kits.
  const puedeGestionar = membresia.rol === "admin_empresa";

  const { filas, categorias, tallas } = await listarInscritos(
    evento.id,
    {
      q: filtros.q,
      categoriaId: filtros.categoria,
      talla: filtros.talla,
      sexo: filtros.sexo,
      estadoPago: filtros.pago as EstadoPago | "sin_pago" | undefined,
    },
    puedeVerPagos
  );

  const parametros = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => Boolean(v)) as [string, string][]
  ).toString();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {/* La vuelta la pone la cabecera del evento, común a todas sus
              pantallas: aquí duplicaba el enlace. */}
          <h1 className="text-2xl font-semibold text-texto">Inscritos</h1>
          <p className="text-sm text-atenuado">
            {filas.length} {filas.length === 1 ? "inscrito" : "inscritos"}
          </p>
        </div>
        <a
          href={`/panel/eventos/${evento.id}/inscritos/exportar.csv?${parametros}`}
          className="rounded-full border px-4 py-2 text-sm font-medium border-linea-fuerte text-atenuado hover:bg-superficie-2"
        >
          Exportar CSV
        </a>
      </div>

      <Suspense fallback={<div className="h-12" />}>
        <FiltrosInscritos categorias={categorias} tallas={tallas} mostrarPago={puedeVerPagos} />
      </Suspense>

      {filas.length ? (
        <div className="overflow-x-auto rounded-2xl border border-linea">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead className="text-xs uppercase tracking-wide bg-superficie text-atenuado">
              <tr>
                <th className="px-4 py-3">Dorsal</th>
                <th className="px-4 py-3">Corredor</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Talla</th>
                <th className="px-4 py-3">Género</th>
                <th className="px-4 py-3">Inscrito</th>
                {puedeVerPagos && <th className="px-4 py-3">Pago</th>}
                <th className="px-4 py-3">Kit</th>
                {puedeGestionar && <th className="px-4 py-3">Gestionar</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {filas.map((f) => (
                <tr key={f.id} className="bg-superficie/40">
                  <td className="px-4 py-3 font-semibold tabular-nums text-texto">
                    {f.numeroDorsal ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-texto">{f.nombre}</p>
                    <p className="text-xs text-atenuado">{f.correo}</p>
                  </td>
                  <td className="px-4 py-3 text-atenuado">{f.categoria}</td>
                  <td className="px-4 py-3 text-atenuado">{f.talla ?? "—"}</td>
                  <td className="px-4 py-3 text-atenuado">
                    {f.sexo ? SEXO_CORTO[f.sexo] : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-atenuado">
                    {formatFechaCorta(f.creadoEn)}
                  </td>
                  {puedeVerPagos && (
                    <td className="px-4 py-3">
                      <Chip tono={ESTADO_PAGO_TONO[f.pago?.estado ?? "pendiente"]}>
                        {f.pago ? ESTADO_PAGO_LABEL[f.pago.estado] : "Sin registrar"}
                      </Chip>
                      <p className="mt-1 text-xs text-atenuado">
                        {formatPrecio(f.precio, f.moneda)}
                      </p>
                    </td>
                  )}
                  <td className="px-4 py-3 text-atenuado">
                    {f.kitEntregado ? "Entregado" : "—"}
                  </td>
                  {puedeGestionar && (
                    <td className="px-4 py-3 align-top">
                      <AccionesInscrito
                        eventoId={evento.id}
                        inscripcionId={f.id}
                        nombre={f.nombre}
                        categoriaActual={categorias.find((c) => c.nombre === f.categoria)?.id ?? ""}
                        tallaActual={f.talla}
                        categorias={categorias}
                        tallas={tallas}
                        kitEntregado={f.kitEntregado}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm border-linea-fuerte text-atenuado">
          No hay inscritos que coincidan con los filtros.
        </p>
      )}
    </div>
  );
}
