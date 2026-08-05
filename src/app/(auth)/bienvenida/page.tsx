import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Aviso } from "@/components/ui/Aviso";
import { BotonEnlace } from "@/components/ui/Boton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cuenta confirmada | RunTicket HN",
  robots: { index: false },
};

/**
 * Aterrizaje después de confirmar el correo.
 *
 * Cae dentro del grupo `(auth)`, así que hereda del layout la marca centrada
 * sin trabajo extra. Cierra el círculo del correo: si el mensaje decía «¡Ya casi
 * estás en la meta!», aquí se confirma la llegada.
 *
 * `verifyOtp` deja la sesión iniciada, de modo que las dos salidas llevan a
 * sitios donde ya se puede hacer algo. Si por lo que sea no hubiera sesión, se
 * ofrece entrar en vez de mandar a una pantalla que rebotaría al login.
 */
export default async function BienvenidaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="font-mono text-[0.625rem] font-bold uppercase tracking-etiqueta text-verde">
          Cuenta confirmada
        </span>
        <h1 className="display text-2xl text-texto">¡Llegaste a la meta!</h1>
        <p className="max-w-80 text-sm leading-relaxed text-atenuado">
          {user
            ? "Tu correo quedó confirmado y ya entraste. No hace falta que vuelvas a iniciar sesión."
            : "Tu correo quedó confirmado y tu cuenta ya está activa. Entra para empezar a inscribirte."}
        </p>
        {/*
          Confirmar abre una pestaña nueva desde el correo, y ahí no queda claro
          si uno entró ni con qué cuenta. Decir el correo lo zanja: sin esto, lo
          natural es buscar un botón de iniciar sesión que ya no hace falta.
        */}
        {user?.email && (
          <p className="font-mono text-[0.65625rem] uppercase tracking-etiqueta text-mudo">
            {user.email}
          </p>
        )}
      </div>

      {user ? (
        <>
          <div className="flex flex-col gap-2.5">
            <BotonEnlace href="/eventos" variante="primaria" ancho>
              Ver carreras
            </BotonEnlace>
            <BotonEnlace href="/portal/perfil" variante="secundaria" ancho>
              Completar mi perfil
            </BotonEnlace>
          </div>
          {/* El perfil no es un adorno: sin fecha de nacimiento ni contacto de
              emergencia la inscripción se detiene a pedirlos. Mejor avisar aquí
              que a mitad del formulario de una carrera. */}
          <Aviso tono="azul">
            Completa tu perfil ahora y tus próximas inscripciones se llenarán solas.
          </Aviso>
        </>
      ) : (
        <div className="flex flex-col gap-2.5">
          <BotonEnlace href="/login" variante="primaria" ancho>
            Entrar a mi cuenta
          </BotonEnlace>
        </div>
      )}
    </div>
  );
}
