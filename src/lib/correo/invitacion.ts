import "server-only";
import { enviarCorreo } from "./enviar";
import { esc, maqueta, sitio } from "./maqueta";

/**
 * Aviso a quien **ya tenía cuenta** y acaba de ser invitado a una empresa.
 *
 * A los usuarios nuevos los avisa Supabase con su propio correo de invitación.
 * A los que ya existían no les llegaba nada: la invitación se anotaba en la
 * base y se quedaba esperando a que entraran al panel por su cuenta, cosa que
 * nadie hace si no sabe que tiene algo que aceptar.
 *
 * No lanza nunca: un fallo del proveedor de correo no debe deshacer la
 * invitación, que ya está registrada.
 */
export async function avisarInvitacionEmpresa(correo: string, empresa: string): Promise<void> {
  const enlace = `${sitio()}/login?como=organizador&next=/panel`;
  try {
    await enviarCorreo({
      para: correo,
      asunto: `Te invitaron a organizar carreras con ${empresa}`,
      html: maqueta({
        asunto: `Te invitaron a organizar carreras con ${empresa}`,
        preencabezado: "Acepta la invitación y entra al panel de organizadores.",
        titulo: "Tienes una invitación",
        bloques: [
          {
            tipo: "parrafo",
            texto: `<strong>${esc(empresa)}</strong> te ha invitado a su panel en RunTicket HN para gestionar sus carreras: inscritos, pagos, entrega de kits y resultados.`,
          },
          {
            tipo: "parrafo",
            texto:
              "Entra con tu cuenta de siempre y acepta la invitación. Es la misma cuenta con la que te inscribes como corredor.",
          },
        ],
        boton: { texto: "Aceptar la invitación", enlace },
        nota: "Si no esperabas esta invitación, puedes ignorar este correo.",
      }),
      texto: `${empresa} te ha invitado a su panel de organizadores en RunTicket HN. Entra y acepta la invitación en: ${enlace}`,
    });
  } catch (e) {
    console.error("No se pudo enviar el correo de invitación", correo, e);
  }
}
