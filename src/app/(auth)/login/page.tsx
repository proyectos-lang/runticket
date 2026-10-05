import Link from "next/link";
import { redirect } from "next/navigation";
import { Aviso } from "@/components/ui/Aviso";
import { getUsuarioActual } from "@/lib/auth/session";
import { ambitoDelUsuario } from "@/lib/auth/destino";
import { rutaInternaSegura } from "@/lib/seguridad";
import { LoginForm } from "./LoginForm";

/**
 * `/auth/confirmar` redirige aquí con `?error=` cuando un enlace de correo no
 * sirve. Ese parámetro se emitía desde el principio y **nadie lo leía**: quien
 * abría un enlace caducado veía el formulario de siempre, sin ninguna
 * explicación, y no entendía por qué no había entrado.
 */
/**
 * Dos motivos, no tres: Supabase responde lo mismo ante un enlace caducado, uno
 * ya usado y uno inventado, así que el texto de `enlace_caducado` cubre los tres
 * casos en vez de afirmar cuál fue. `enlace_invalido` queda para cuando ni
 * siquiera llegó un token.
 */
const MOTIVOS = {
  enlace_caducado: {
    titulo: "Ese enlace ya no sirve",
    texto:
      "Pudo caducar o haberse usado antes; los enlaces de correo valen una sola vez y duran poco. Pide uno nuevo y listo.",
  },
  enlace_invalido: {
    titulo: "Ese enlace está incompleto",
    texto:
      "Suele pasar cuando se corta al copiarlo del correo. Vuelve a abrirlo desde el mensaje original o pide uno nuevo.",
  },
} as const;

/**
 * Una sola puerta para corredores y organizadores —es la misma cuenta—, pero
 * con dos rótulos. Antes la pantalla decía solo «Entrar» y quien organizaba
 * carreras no sabía si era su sitio; con `?como=organizador` el título, la
 * explicación y el destino tras entrar son los del panel.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; como?: string }>;
}) {
  const { next, error, como } = await searchParams;
  const motivo = error && error in MOTIVOS ? MOTIVOS[error as keyof typeof MOTIVOS] : null;
  const organizador = como === "organizador";

  // Quien ya está dentro no tiene nada que hacer aquí: se le lleva a donde iba,
  // o a su área. Antes veía el formulario otra vez, como si no hubiera entrado.
  if (await getUsuarioActual()) {
    redirect(rutaInternaSegura(next) ?? (await ambitoDelUsuario()).href);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="font-mono text-[0.625rem] font-bold uppercase tracking-etiqueta text-mudo">
          {organizador ? "Organizadores" : "Corredores"}
        </span>
        <h1 className="text-[1.375rem] font-extrabold tracking-display text-texto">
          {organizador ? "Entrar al panel de organizadores" : "Entrar"}
        </h1>
        <p className="max-w-xs text-sm leading-relaxed text-atenuado">
          {organizador
            ? "Con la cuenta con la que te invitaron a tu empresa. Una sola cuenta sirve para organizar y para correr."
            : "Una sola cuenta para inscribirte, ver tu dorsal y tus resultados."}
        </p>
      </div>

      {motivo && (
        <Aviso
          tono="rojo"
          titulo={motivo.titulo}
          accion={
            <Link
              href="/recuperar-password"
              className="whitespace-nowrap text-sm underline underline-offset-2"
            >
              Pedir otro
            </Link>
          }
        >
          {motivo.texto}
        </Aviso>
      )}

      <LoginForm next={next ?? (organizador ? "/panel" : undefined)} organizador={organizador} />

      <p className="text-center text-sm text-atenuado">
        {organizador ? (
          <>
            ¿Vienes a correr?{" "}
            <Link href="/login" className="font-semibold text-cian hover:underline">
              Entrar como corredor
            </Link>
          </>
        ) : (
          <>
            ¿Organizas carreras?{" "}
            <Link href="/login?como=organizador" className="font-semibold text-cian hover:underline">
              Entrar al panel
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
