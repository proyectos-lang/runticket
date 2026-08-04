import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel, getMembresiasActivas } from "@/lib/auth/session";
import { ESTADO_EMPRESA, ESTADO_MEMBRESIA, ROL_EMPRESA } from "@/lib/estados";
import { ChipEstado } from "@/components/ui/Chip";
import { CabeceraModulo } from "@/components/panel/EstadoVacio";
import { notFound, redirect } from "next/navigation";
import { Aviso } from "@/components/ui/Aviso";

export const dynamic = "force-dynamic";

/**
 * Ficha de la empresa desde el panel. Es de solo lectura a propósito: el alta y
 * la edición de empresas son competencia del super-administrador de la
 * plataforma, no del organizador.
 */
export default async function ConfiguracionPage() {
  const membresia = await getEmpresaActivaDelPanel();
  if (membresia.rol !== "admin_empresa") redirect("/panel");

  const supabase = await createClient();
  const [{ data: empresa }, { data: miembros }, membresias] = await Promise.all([
    supabase.from("empresas").select("*").eq("id", membresia.empresaId).maybeSingle(),
    supabase
      .from("empresa_miembros")
      .select("id, usuario_id, rol, estado")
      .eq("empresa_id", membresia.empresaId),
    getMembresiasActivas(),
  ]);

  // Sin la ficha de la empresa esta pantalla no dice nada y, sobre todo, el
  // enlace a la página pública salía como `/organizadores/undefined`.
  if (!empresa) notFound();

  const { data: perfiles } = miembros?.length
    ? await supabase
        .from("perfiles")
        .select("id, nombres, apellidos, correo")
        .in(
          "id",
          miembros.map((m) => m.usuario_id)
        )
    : { data: [] as never[] };

  return (
    <div className="flex flex-col gap-8">
      <CabeceraModulo
        titulo="Mi empresa"
        descripcion="Los datos con los que apareces ante los corredores y quién tiene acceso al panel."
      />

      <section className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-texto">
            {empresa?.nombre_comercial}
          </h2>
          {empresa && <ChipEstado estilo={ESTADO_EMPRESA[empresa.estado]} />}
        </div>

        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-atenuado">Página pública</dt>
            <dd>
              <Link
                href={`/organizadores/${empresa?.slug}`}
                target="_blank"
                className="underline underline-offset-2 text-texto"
              >
                /organizadores/{empresa?.slug}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-atenuado">RTN</dt>
            <dd className="text-texto">{empresa?.rtn ?? "Sin registrar"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-atenuado">Correo de contacto</dt>
            <dd className="text-texto">
              {empresa?.correo_contacto ?? "Sin registrar"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-atenuado">Teléfono</dt>
            <dd className="text-texto">
              {empresa?.telefono_contacto ?? "Sin registrar"}
              {!empresa?.telefono_contacto && (
                <span className="ml-2 text-xs text-amber-400">
                  Sin él no se puede cobrar por WhatsApp
                </span>
              )}
            </dd>
          </div>
        </dl>

        <p className="border-t pt-4 text-xs border-linea text-atenuado">
          Para cambiar estos datos o el logo, escribe al administrador de la plataforma.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <Aviso tono="azul" titulo="Este es el teléfono del botón de WhatsApp">
          Cuando un corredor pulsa «Coordinar por WhatsApp» para pagar, se abre una
          conversación con este número y la referencia y el monto ya escritos. Si cambia,
          actualízalo aquí o los pagos dejarán de llegarte.
        </Aviso>

        <h2 className="font-mono text-[0.6875rem] font-semibold uppercase tracking-etiqueta text-mudo">
          Equipo
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-linea">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide bg-superficie text-atenuado">
              <tr>
                <th className="px-4 py-3">Persona</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {(miembros ?? []).map((m) => {
                const perfil = perfiles?.find((p) => p.id === m.usuario_id);
                return (
                  <tr key={m.id} className="bg-superficie/40">
                    <td className="px-4 py-3">
                      <p className="text-texto">
                        {[perfil?.nombres, perfil?.apellidos].filter(Boolean).join(" ") || "—"}
                      </p>
                      <p className="text-xs text-atenuado">{perfil?.correo}</p>
                    </td>
                    <td className="px-4 py-3">
                      <ChipEstado estilo={ROL_EMPRESA[m.rol]} />
                    </td>
                    <td className="px-4 py-3">
                      <ChipEstado estilo={ESTADO_MEMBRESIA[m.estado]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-atenuado">
          El operador solo entrega kits y consulta inscritos: no ve pagos ni métricas.
        </p>
      </section>

      {membresias.length > 1 && (
        <p className="text-sm text-atenuado">
          Perteneces a {membresias.length} empresas. Puedes cambiar entre ellas desde el selector
          del menú lateral.
        </p>
      )}
    </div>
  );
}
