import Link from "next/link";
import { Aviso } from "@/components/ui/Aviso";
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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const motivo = error && error in MOTIVOS ? MOTIVOS[error as keyof typeof MOTIVOS] : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-[1.375rem] font-extrabold tracking-display text-texto">
        Entrar
      </h1>

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

      <LoginForm next={next} />
    </div>
  );
}
