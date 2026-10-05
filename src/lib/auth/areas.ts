import "server-only";
import { esSuperAdmin, getInvitacionesPendientes, getMembresiasActivas } from "./session";
import type { OtraArea } from "@/components/shell/AppShell";

/**
 * Las áreas a las que esta persona puede pasar desde la que tiene abierta.
 *
 * Todo el mundo tiene portal (cualquiera puede correr); el panel lo tienen los
 * miembros de alguna empresa —o quien tiene una invitación por aceptar, que
 * solo se acepta allí— y la consola, el administrador de la plataforma. Se
 * excluye el área actual, que no tiene sentido ofrecer.
 */
export async function otrasAreasDe(actual: "/portal" | "/panel" | "/admin"): Promise<OtraArea[]> {
  const [superAdmin, membresias, invitaciones] = await Promise.all([
    esSuperAdmin(),
    getMembresiasActivas(),
    getInvitacionesPendientes(),
  ]);

  const todas: OtraArea[] = [
    { href: "/portal", etiqueta: "Mi cuenta de corredor" },
    ...(membresias.length > 0
      ? [{ href: "/panel", etiqueta: "Panel de organizador" }]
      : invitaciones.length > 0
        ? [{ href: "/panel", etiqueta: "Aceptar invitación" }]
        : []),
    ...(superAdmin ? [{ href: "/admin", etiqueta: "Consola" }] : []),
  ];
  return todas.filter((a) => a.href !== actual);
}
