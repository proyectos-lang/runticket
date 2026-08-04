import Link from "next/link";
import { getUsuarioActual } from "@/lib/auth/session";
import { BotonEnlace } from "@/components/ui/Boton";
import { Marca } from "./Marca";

export async function Header() {
  const usuario = await getUsuarioActual();

  return (
    <header className="sticky top-0 z-30 border-b border-linea bg-fondo/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3.5 sm:px-6 lg:px-10">
        <Marca />
        <nav className="flex items-center gap-3 text-sm font-semibold sm:gap-5">
          <Link href="/eventos" className="text-atenuado transition-colors hover:text-texto">
            Carreras
          </Link>
          {usuario ? (
            // La cabecera acompaña a todas las pantallas: su botón nunca es el
            // primario, o competiría con la acción de cada una.
            <BotonEnlace variante="secundaria" tamano="sm" href="/portal">
              Mi cuenta
            </BotonEnlace>
          ) : (
            <>
              <Link href="/login" className="text-atenuado transition-colors hover:text-texto">
                Entrar
              </Link>
              <BotonEnlace variante="secundaria" tamano="sm" href="/registro">
                Crear cuenta
              </BotonEnlace>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
