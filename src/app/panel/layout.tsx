import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getUsuarioActual,
  getMembresiasActivas,
  getInvitacionesPendientes,
  getEmpresaActivaDelPanel,
  necesitaElegirEmpresa,
} from "@/lib/auth/session";
import { ElegirEmpresa } from "./ElegirEmpresa";
import { aceptarInvitacionEmpresa, cerrarSesion } from "@/lib/auth/actions";
import { AppShell } from "@/components/shell/AppShell";
import { SelectorEmpresa } from "@/components/shell/SelectorEmpresa";
import { navPanel } from "@/components/shell/navegacion";
import { TIPOS_DE_PANEL } from "@/lib/notificaciones";
import { Boton } from "@/components/ui/Boton";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login?next=/panel");

  const membresias = await getMembresiasActivas();

  // Sin membresías no hay panel que enmarcar: se muestran las invitaciones
  // pendientes fuera del shell.
  if (membresias.length === 0) {
    const invitaciones = await getInvitacionesPendientes();
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
        <h1 className="text-center text-xl font-semibold text-texto">
          Panel de empresa
        </h1>
        {invitaciones.length > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-center text-sm text-atenuado">
              Tienes invitaciones pendientes:
            </p>
            {invitaciones.map((inv) => (
              <form
                key={inv.empresaId}
                action={aceptarInvitacionEmpresa.bind(null, inv.empresaId)}
                className="flex items-center justify-between rounded-xl border px-4 py-3 border-linea bg-superficie"
              >
                <span className="text-sm text-texto">{inv.nombreComercial}</span>
                <Boton variante="primaria" tamano="sm" type="submit">
                  Aceptar
                </Boton>
              </form>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-atenuado">
            Todavía no tienes acceso a ningún panel de empresa.
          </p>
        )}
        <form action={cerrarSesion} className="self-center">
          <button type="submit" className="text-sm text-mudo hover:text-texto">
            Cerrar sesión
          </button>
        </form>
      </main>
    );
  }

  // Con varias empresas y sin elección previa se pregunta, en vez de entrar en
  // una al azar: el rol de cada una cambia qué módulos se ven.
  if (await necesitaElegirEmpresa()) {
    return <ElegirEmpresa membresias={membresias} />;
  }

  const activa = await getEmpresaActivaDelPanel();

  // Contadores del menú. Solo se piden los que el rol puede ver: al operador no
  // se le cuenta nada financiero, ni siquiera para pintar una cifra.
  const supabase = await createClient();
  const esAdmin = activa.rol === "admin_empresa";
  const [{ count: carreras }, { count: enEspera }, { count: porVerificar }, { count: avisos }] =
    await Promise.all([
    supabase
      .from("eventos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", activa.empresaId),
    // `lista_espera` no guarda la empresa: se filtra por el evento, que sí la
    // tiene, con el join embebido de PostgREST.
    esAdmin
      ? supabase
          .from("lista_espera")
          .select("id, eventos!inner(empresa_id)", { count: "exact", head: true })
          .eq("eventos.empresa_id", activa.empresaId)
          .in("estado", ["esperando", "notificado"])
      : Promise.resolve({ count: 0 }),
    esAdmin
      ? supabase
          .from("pagos")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", activa.empresaId)
          .eq("estado", "en_verificacion")
      : Promise.resolve({ count: 0 }),
    // Sin filtro de empresa: la RLS ya limita las filas a este usuario, y el
    // tipo es lo que separa lo que le llega como organizador de lo que le llega
    // como corredor.
    supabase
      .from("notificaciones")
      .select("id", { count: "exact", head: true })
      .eq("leido", false)
      .in("tipo", [...TIPOS_DE_PANEL]),
  ]);

  return (
    <AppShell
      secciones={navPanel(activa.rol, {
        carreras: carreras ?? 0,
        enEspera: enEspera ?? 0,
        porVerificar: porVerificar ?? 0,
        avisos: avisos ?? 0,
      })}
      titulo={activa.nombreComercial}
      rolEmpresa={activa.rol}
      correo={usuario.email ?? undefined}
      encabezado={<SelectorEmpresa membresias={membresias} activa={activa} />}
    >
      {children}
    </AppShell>
  );
}
