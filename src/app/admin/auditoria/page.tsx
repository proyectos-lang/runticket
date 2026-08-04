import { createClient } from "@/lib/supabase/server";
import { formatFechaHora } from "@/lib/format";
import { PildoraEnlace } from "@/components/ui/Pildora";

export const dynamic = "force-dynamic";

const POR_PAGINA = 100;

/** Etiquetas legibles para las acciones que la aplicación registra. */
const ACCION_LABEL: Record<string, string> = {
  "inscripcion.crear": "Inscripción creada",
  "inscripcion.anular": "Inscripción anulada",
  "pago.pagado": "Pago confirmado",
  "pago.rechazado": "Pago rechazado",
  "pago.reembolsado": "Pago reembolsado",
  "pago.anulado": "Pago anulado",
  "pago.en_verificacion": "Pago en verificación",
  "pago.pendiente": "Pago pendiente",
  "pago.registrado_manual": "Cobro registrado a mano",
  "cuenta.password_cambiada": "Contraseña cambiada",
  "usuario.creado": "Usuario creado",
};

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ accion?: string }>;
}) {
  const { accion } = await searchParams;
  const supabase = await createClient();

  // La RLS limita esto al super-admin y a los administradores de cada empresa.
  let consulta = supabase
    .from("bitacora_auditoria")
    .select("id, usuario_id, empresa_id, accion, entidad, entidad_id, datos_nuevos, ip_address, created_at")
    .order("created_at", { ascending: false })
    .limit(POR_PAGINA);

  if (accion) consulta = consulta.eq("accion", accion);

  const { data: entradas } = await consulta;

  const [{ data: perfiles }, { data: empresas }] = await Promise.all([
    entradas?.length
      ? supabase
          .from("perfiles")
          .select("id, nombres, apellidos, correo")
          .in("id", [...new Set(entradas.map((e) => e.usuario_id).filter(Boolean) as string[])])
      : Promise.resolve({ data: [] as never[] }),
    entradas?.length
      ? supabase
          .from("empresas")
          .select("id, nombre_comercial")
          .in("id", [...new Set(entradas.map((e) => e.empresa_id).filter(Boolean) as string[])])
      : Promise.resolve({ data: [] as never[] }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="display text-2xl text-texto">Bitácora</h1>
        <p className="text-sm text-atenuado">
          Registro inmutable de las acciones sensibles: cobros, anulaciones e inscripciones. No se
          puede editar ni borrar, tampoco desde aquí.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <PildoraEnlace href="/admin/auditoria" activa={!accion}>
          Todo
        </PildoraEnlace>
        {Object.entries(ACCION_LABEL).map(([valor, etiqueta]) => (
          <PildoraEnlace
            key={valor}
            href={`/admin/auditoria?accion=${valor}`}
            activa={accion === valor}
          >
            {etiqueta}
          </PildoraEnlace>
        ))}
      </div>

      {entradas?.length ? (
        <div className="overflow-x-auto rounded-2xl border border-linea">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide bg-superficie text-atenuado">
              <tr>
                <th className="px-4 py-3">Cuándo</th>
                <th className="px-4 py-3">Quién</th>
                <th className="px-4 py-3">Acción</th>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {entradas.map((e) => {
                const perfil = perfiles?.find((p) => p.id === e.usuario_id);
                return (
                  <tr key={e.id} className="bg-superficie/40">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-atenuado">
                      {formatFechaHora(e.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-texto">
                        {[perfil?.nombres, perfil?.apellidos].filter(Boolean).join(" ") || "Sistema"}
                      </p>
                      <p className="text-xs text-atenuado">
                        {perfil?.correo}
                        {e.ip_address && ` · ${e.ip_address}`}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-atenuado">
                      {ACCION_LABEL[e.accion] ?? e.accion}
                    </td>
                    <td className="px-4 py-3 text-atenuado">
                      {empresas?.find((x) => x.id === e.empresa_id)?.nombre_comercial ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {e.datos_nuevos && (
                        <code className="text-xs text-atenuado">
                          {JSON.stringify(e.datos_nuevos).slice(0, 90)}
                        </code>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm border-linea-fuerte text-atenuado">
          Sin registros todavía.
        </p>
      )}
    </div>
  );
}
