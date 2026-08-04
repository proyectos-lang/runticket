import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { BuscadorUsuarios } from "./BuscadorUsuarios";
import { FilaUsuario } from "./FilaUsuario";
import { CrearUsuarioForm } from "./CrearUsuarioForm";

export const dynamic = "force-dynamic";

const POR_PAGINA = 50;

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  // La RLS de `perfiles` ya restringe esta lectura al super_admin, así que basta
  // con el cliente del usuario; no hace falta service role.
  let consulta = supabase
    .from("perfiles")
    .select("id, nombres, apellidos, correo, rol_plataforma, created_at")
    .order("created_at", { ascending: false })
    .limit(POR_PAGINA);

  if (q?.trim()) {
    const patron = `%${q.trim()}%`;
    consulta = consulta.or(
      `correo.ilike.${patron},nombres.ilike.${patron},apellidos.ilike.${patron}`
    );
  }

  const { data: perfiles } = await consulta;

  // Empresas a las que pertenece cada usuario, para saber de un vistazo quién es quién.
  const { data: membresias } = perfiles?.length
    ? await supabase
        .from("empresa_miembros")
        .select("usuario_id, empresa_id, estado")
        .in(
          "usuario_id",
          perfiles.map((p) => p.id)
        )
        .eq("estado", "activo")
    : { data: [] as never[] };

  const { data: empresas } = membresias?.length
    ? await supabase
        .from("empresas")
        .select("id, nombre_comercial")
        .in("id", [...new Set(membresias.map((m) => m.empresa_id))])
    : { data: [] as never[] };

  // Todas las empresas, no solo las que ya tienen miembros: el desplegable del
  // alta sirve justo para meter a la primera persona en una empresa recién
  // creada, que por definición no aparece en la consulta de arriba.
  const { data: todasLasEmpresas } = await supabase
    .from("empresas")
    .select("id, nombre_comercial")
    .order("nombre_comercial");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="display text-2xl text-texto">Usuarios</h1>
        <p className="text-sm text-atenuado">
          Todas las cuentas de la plataforma. Los últimos {POR_PAGINA} registros, o los que
          coincidan con la búsqueda.
        </p>
      </div>

      <CrearUsuarioForm
        empresas={(todasLasEmpresas ?? []).map((e) => ({ id: e.id, nombre: e.nombre_comercial }))}
      />

      <Suspense fallback={<div className="h-10" />}>
        <BuscadorUsuarios />
      </Suspense>

      {perfiles?.length ? (
        <div className="overflow-x-auto rounded-2xl border border-linea">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide bg-superficie text-atenuado">
              <tr>
                <th className="px-4 py-3">Persona</th>
                <th className="px-4 py-3">Empresas</th>
                <th className="px-4 py-3">Rol de plataforma</th>
                <th className="px-4 py-3">Alta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {perfiles.map((p) => (
                <FilaUsuario
                  key={p.id}
                  usuario={{
                    id: p.id,
                    nombre: [p.nombres, p.apellidos].filter(Boolean).join(" "),
                    correo: p.correo ?? "",
                    rolPlataforma: p.rol_plataforma,
                    empresas: (membresias ?? [])
                      .filter((m) => m.usuario_id === p.id)
                      .map(
                        (m) =>
                          empresas?.find((e) => e.id === m.empresa_id)?.nombre_comercial ?? ""
                      )
                      .filter(Boolean),
                    creadoEn: p.created_at,
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm border-linea-fuerte text-atenuado">
          No hay usuarios que coincidan con la búsqueda.
        </p>
      )}
    </div>
  );
}
