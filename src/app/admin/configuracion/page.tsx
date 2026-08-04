import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPerfilActual } from "@/lib/auth/session";
import { formatFechaHora } from "@/lib/format";
import { EtiquetaMono } from "@/components/ui/Datos";
import { PlacaAmbito } from "@/components/admin/Chips";
import { CambiarPasswordForm } from "./CambiarPasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi cuenta | RunTicket",
  robots: { index: false },
};

/**
 * Cuenta del super-administrador.
 *
 * El rol ya lo exige `admin/layout.tsx`, así que aquí no se vuelve a comprobar
 * para entrar; la acción de cambio de contraseña sí lo revalida por su cuenta,
 * porque una acción de servidor es alcanzable sin pasar por esta pantalla.
 */
export default async function ConfiguracionAdminPage() {
  const perfil = await getPerfilActual();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <PlacaAmbito />
        <h1 className="display text-2xl text-texto">Mi cuenta</h1>
        <p className="max-w-160 text-sm leading-relaxed text-atenuado">
          Esta cuenta manda sobre toda la plataforma: da de alta empresas, cambia roles y ve la
          bitácora de todas ellas. Trátala en consecuencia.
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
        <EtiquetaMono>Datos de acceso</EtiquetaMono>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="font-mono text-[0.65625rem] uppercase tracking-etiqueta text-mudo">
              Correo
            </dt>
            <dd className="text-texto">{user?.email ?? "—"}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-mono text-[0.65625rem] uppercase tracking-etiqueta text-mudo">
              Nombre
            </dt>
            <dd className="text-texto">
              {`${perfil?.nombres ?? ""} ${perfil?.apellidos ?? ""}`.trim() || "Sin registrar"}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-mono text-[0.65625rem] uppercase tracking-etiqueta text-mudo">
              Último acceso
            </dt>
            <dd className="tabular font-mono text-xs text-texto/45">
              {user?.last_sign_in_at ? formatFechaHora(user.last_sign_in_at) : "—"}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-mono text-[0.65625rem] uppercase tracking-etiqueta text-mudo">
              Cuenta creada
            </dt>
            <dd className="tabular font-mono text-xs text-texto/45">
              {user?.created_at ? formatFechaHora(user.created_at) : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
        <div className="flex flex-col gap-1">
          <EtiquetaMono>Contraseña</EtiquetaMono>
          <p className="max-w-160 text-sm text-atenuado">
            El cambio queda registrado en la bitácora. Si no reconoces uno, alguien tuvo acceso a
            tu sesión.
          </p>
        </div>
        <CambiarPasswordForm />
      </section>
    </div>
  );
}
