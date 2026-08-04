import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChipEstadoEmpresa, ZonaPeligrosa } from "@/components/admin/Chips";
import { Boton } from "@/components/ui/Boton";
import { actualizarEstadoEmpresa } from "../actions";
import { EditarEmpresaForm } from "./EditarEmpresaForm";
import { InvitarMiembroForm } from "./InvitarMiembroForm";
import { FilaMiembro } from "./FilaMiembro";
import { LogoEmpresa } from "./LogoEmpresa";

export const dynamic = "force-dynamic";

export default async function EmpresaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: empresa } = await supabase.from("empresas").select("*").eq("id", id).maybeSingle();
  if (!empresa) notFound();

  const { data: miembros } = await supabase
    .from("empresa_miembros")
    .select("id, usuario_id, rol, estado, invitado_en")
    .eq("empresa_id", id)
    .order("invitado_en", { ascending: false });

  const { data: perfiles } = miembros?.length
    ? await supabase
        .from("perfiles")
        .select("id, nombres, apellidos, correo")
        .in(
          "id",
          miembros.map((m) => m.usuario_id)
        )
    : { data: [] };

  const { count: eventos } = await supabase
    .from("eventos")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", id);

  // Solo los administradores ACTIVOS gobiernan la empresa; un invitado todavía no
  // ha aceptado y no pasa las funciones de rol de la base de datos.
  const adminsActivos = (miembros ?? []).filter(
    (m) => m.rol === "admin_empresa" && m.estado === "activo"
  );

  const toggleEstado = empresa.estado === "suspendida" ? "activa" : "suspendida";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin/empresas" className="text-sm text-mudo hover:text-texto">
          ← Empresas
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="display text-2xl text-texto">{empresa.nombre_comercial}</h1>
              <ChipEstadoEmpresa estado={empresa.estado} />
            </div>
            <p className="mt-1 text-sm text-atenuado">
              {eventos ?? 0} {eventos === 1 ? "evento" : "eventos"} · /organizadores/{empresa.slug}
            </p>
          </div>
          <Link
            href={`/organizadores/${empresa.slug}`}
            target="_blank"
            className="font-mono text-xs uppercase tracking-etiqueta text-cian hover:underline"
          >
            Ver página pública ↗
          </Link>
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
        <h2 className="text-lg font-semibold text-texto">Identidad</h2>
        <LogoEmpresa empresaId={empresa.id} logo={empresa.logo_url} />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
        <h2 className="text-lg font-semibold text-texto">Datos de la empresa</h2>
        <EditarEmpresaForm empresaId={empresa.id} empresa={empresa} />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
        <h2 className="text-lg font-semibold text-texto">Invitar al equipo</h2>
        <p className="-mt-2 text-sm text-atenuado">
          El administrador gestiona eventos y cobros. El operador solo entrega kits y consulta
          inscritos: nunca ve información financiera.
        </p>
        <InvitarMiembroForm empresaId={empresa.id} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-texto">Equipo</h2>
        {miembros?.length ? (
          <div className="overflow-x-auto rounded-2xl border border-linea">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide bg-superficie text-atenuado">
                <tr>
                  <th className="px-4 py-3">Persona</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {miembros.map((miembro) => {
                  const perfil = perfiles?.find((p) => p.id === miembro.usuario_id);
                  return (
                    <FilaMiembro
                      key={miembro.id}
                      empresaId={empresa.id}
                      esUltimoAdmin={
                        miembro.rol === "admin_empresa" &&
                        miembro.estado === "activo" &&
                        adminsActivos.length === 1
                      }
                      miembro={{
                        usuarioId: miembro.usuario_id,
                        nombre: [perfil?.nombres, perfil?.apellidos].filter(Boolean).join(" "),
                        correo: perfil?.correo ?? "",
                        rol: miembro.rol,
                        estado: miembro.estado,
                      }}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm border-linea-fuerte text-atenuado">
            Todavía no hay nadie en el equipo de esta empresa.
          </p>
        )}
      </section>
      <ZonaPeligrosa
        titulo={empresa.estado === "suspendida" ? "Empresa suspendida" : "Zona peligrosa"}
        descripcion={
          empresa.estado === "suspendida"
            ? "Sus carreras están ocultas en la web pública y su equipo no puede entrar al panel. Las inscripciones y los pagos siguen intactos; al reactivarla, todo vuelve a estar disponible."
            : "Suspender oculta sus carreras de la web pública y bloquea el acceso de su equipo al panel. Las inscripciones y los pagos se conservan intactos, y la acción es reversible."
        }
      >
        <form action={actualizarEstadoEmpresa.bind(null, empresa.id, toggleEstado)}>
          <Boton
            type="submit"
            variante={empresa.estado === "suspendida" ? "secundaria" : "peligro"}
          >
            {empresa.estado === "suspendida" ? "Reactivar empresa" : "Suspender empresa"}
          </Boton>
        </form>
      </ZonaPeligrosa>

    </div>
  );
}
