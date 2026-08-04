import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { ESTADO_LISTA_ESPERA } from "@/lib/estados";
import { ChipEstado } from "@/components/ui/Chip";
import { formatFechaCorta, formatFechaHora } from "@/lib/format";
import { BotonNotificar, BotonQuitar } from "./AccionesListaEspera";

export const dynamic = "force-dynamic";

export default async function ListaEsperaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membresia = await getEmpresaActivaDelPanel();
  if (membresia.rol !== "admin_empresa") redirect(`/panel/eventos/${id}`);

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("id, zona_horaria")
    .eq("id", id)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) notFound();

  const [{ data: cola }, { data: categorias }] = await Promise.all([
    supabase
      .from("lista_espera")
      .select("id, categoria_id, usuario_id, estado, notificado_en, enlace_expira_en, created_at")
      .eq("evento_id", id)
      .order("created_at"),
    supabase.from("categorias").select("id, nombre, cupo_maximo").eq("evento_id", id).order("nombre"),
  ]);

  const { data: perfiles } = cola?.length
    ? await supabase
        .from("perfiles")
        .select("id, nombres, apellidos, correo, telefono")
        .in("id", [...new Set(cola.map((c) => c.usuario_id))])
    : { data: [] as never[] };

  const pendientes = (cola ?? []).filter((c) => c.estado === "esperando" || c.estado === "notificado");

  // Solo la primera cola con gente esperando y sin ventana abierta lleva el
  // botón naranja; el resto avisa igual, en secundario.
  const idPrimeraCola =
    categorias?.find((c) => {
      const enCategoria = pendientes.filter((p) => p.categoria_id === c.id);
      return (
        enCategoria.some((p) => p.estado === "esperando") &&
        !enCategoria.some((p) => p.estado === "notificado")
      );
    })?.id ?? null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-texto">Lista de espera</h2>
        <p className="text-sm text-atenuado">
          Cuando se libere un cupo, avisa al primero de la cola. Tiene 24 horas para completar su
          inscripción; pasado ese plazo puedes avisar al siguiente.
        </p>
      </div>

      {categorias?.length ? (
        <div className="flex flex-col gap-3">
          {/* La primera categoría con gente esperando —y sin ventana abierta— es
              la única que lleva el botón naranja. */}
          {categorias.map((c) => {
            const enCategoria = pendientes.filter((p) => p.categoria_id === c.id);
            const esperando = enCategoria.filter((p) => p.estado === "esperando").length;
            const notificados = enCategoria.filter((p) => p.estado === "notificado").length;

            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4 border-linea bg-superficie"
              >
                <div>
                  <p className="font-medium text-texto">{c.nombre}</p>
                  <p className="text-sm text-atenuado">
                    {esperando} en espera
                    {notificados > 0 && ` · ${notificados} con la ventana abierta`}
                  </p>
                </div>
                <BotonNotificar
                  eventoId={id}
                  categoriaId={c.id}
                  categoria={c.nombre}
                  hayEsperando={esperando > 0 && notificados === 0}
                  destacado={c.id === idPrimeraCola}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-atenuado">
          Este evento no tiene categorías todavía.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-texto">
          Cola completa ({cola?.length ?? 0})
        </h3>
        {cola?.length ? (
          <div className="overflow-x-auto rounded-2xl border border-linea">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide bg-superficie text-atenuado">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Corredor</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Se apuntó</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {cola.map((c, i) => {
                  const perfil = perfiles?.find((p) => p.id === c.usuario_id);
                  return (
                    <tr key={c.id} className="bg-superficie/40">
                      <td className="px-4 py-3 tabular-nums text-atenuado">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-texto">
                          {[perfil?.nombres, perfil?.apellidos].filter(Boolean).join(" ") || "—"}
                        </p>
                        <p className="text-xs text-atenuado">
                          {perfil?.correo}
                          {perfil?.telefono && ` · ${perfil.telefono}`}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-atenuado">
                        {categorias?.find((x) => x.id === c.categoria_id)?.nombre ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-atenuado">
                        {formatFechaCorta(c.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <ChipEstado estilo={ESTADO_LISTA_ESPERA[c.estado]} />
                        {c.estado === "notificado" && c.enlace_expira_en && (
                          <p className="mt-1 text-xs text-atenuado">
                            Vence {formatFechaHora(c.enlace_expira_en, evento.zona_horaria)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <BotonQuitar eventoId={id} listaEsperaId={c.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm border-linea-fuerte text-atenuado">
            Nadie en lista de espera. Aparecerán aquí cuando una categoría se llene y alguien pida
            que le avisen.
          </p>
        )}
      </section>
    </div>
  );
}
