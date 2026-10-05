import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getUsuarioActual,
  getMembresiasActivas,
  getInvitacionesPendientes,
  getEmpresaActivaDelPanel,
  necesitaElegirEmpresa,
} from "@/lib/auth/session";
import { otrasAreasDe } from "@/lib/auth/areas";
import { ElegirEmpresa } from "./ElegirEmpresa";
import { aceptarInvitacionEmpresa, cerrarSesion } from "@/lib/auth/actions";
import { AppShell } from "@/components/shell/AppShell";
import { SelectorEmpresa } from "@/components/shell/SelectorEmpresa";
import { navPanel } from "@/components/shell/navegacion";
import { TIPOS_DE_PANEL } from "@/lib/notificaciones";
import { Boton, BotonEnlace } from "@/components/ui/Boton";
import { MarcaVertical } from "@/components/publico/MarcaVertical";
import { enlaceWhatsAppPlataforma, MENSAJE_ORGANIZADOR, WHATSAPP_PLATAFORMA } from "@/lib/contacto";

/**
 * El panel es dinámico de principio a fin y no hay nada que prerenderizar: cada
 * pantalla depende de quién entra, de qué empresa tiene activa y de su rol.
 *
 * El `<Suspense>` es lo que lo declara. Cubre el shell **y las páginas de
 * debajo**, que se renderizan dentro de él, así que ninguna necesita marcarse
 * una por una. El `fallback` va vacío a propósito: aquí no hay armazón que
 * enseñar antes de saber quién eres. Lo que sí hay, desde `loading.tsx`, es un
 * esqueleto para las navegaciones **entre** pantallas del panel, que es donde
 * la espera se notaba.
 */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <PanelAutenticado>{children}</PanelAutenticado>
    </Suspense>
  );
}

async function PanelAutenticado({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login?next=/panel");

  const membresias = await getMembresiasActivas();

  // Sin membresías no hay panel que enmarcar. Aquí llega un corredor que pulsó
  // «Organizadores» por curiosidad, o alguien invitado que viene a aceptar. En
  // los dos casos tiene que poder salir: antes esta pantalla solo ofrecía
  // «Cerrar sesión».
  if (membresias.length === 0) {
    const invitaciones = await getInvitacionesPendientes();
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
        <MarcaVertical />
        <div className="flex flex-col gap-2 text-center">
          <h1 className="display text-2xl text-texto">Panel de organizadores</h1>
          <p className="text-sm leading-relaxed text-atenuado">
            {invitaciones.length > 0
              ? "Te invitaron a gestionar carreras. Acepta la invitación para entrar al panel de la empresa."
              : "Tu cuenta no administra ninguna empresa todavía. Si organizas carreras, escríbenos y damos de alta tu empresa; te llegará la invitación a esta misma cuenta."}
          </p>
          {invitaciones.length === 0 && (
            <a
              href={enlaceWhatsAppPlataforma(MENSAJE_ORGANIZADOR)}
              target="_blank"
              rel="noopener noreferrer"
              className="mx-auto mt-1 inline-flex items-center gap-2 rounded-full border border-linea-fuerte px-4 py-2 text-sm font-semibold text-texto transition-colors hover:border-texto/25"
            >
              WhatsApp {WHATSAPP_PLATAFORMA}
            </a>
          )}
        </div>
        {invitaciones.length > 0 && (
          <div className="flex flex-col gap-3">
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
        )}
        <div className="flex flex-col gap-2.5">
          <BotonEnlace
            href="/portal"
            variante={invitaciones.length > 0 ? "secundaria" : "primaria"}
            ancho
          >
            Ir a mi cuenta de corredor
          </BotonEnlace>
          <BotonEnlace href="/eventos" variante="fantasma" ancho>
            Ver carreras
          </BotonEnlace>
        </div>
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
  const [{ count: carreras }, { count: enEspera }, { count: porVerificar }, { count: avisos }, otrasAreas] =
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
      otrasAreasDe("/panel"),
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
      otrasAreas={otrasAreas}
    >
      {children}
    </AppShell>
  );
}
