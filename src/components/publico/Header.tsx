import Link from "next/link";
import { Suspense } from "react";
import { getUsuarioActual } from "@/lib/auth/session";
import { ambitoDelUsuario } from "@/lib/auth/destino";
import { BotonEnlace } from "@/components/ui/Boton";
import { Marca } from "./Marca";

/**
 * Cabecera pública.
 *
 * Es la razón por la que **todo el sitio público era dinámico**: leía la sesión
 * en el layout, y con eso ninguna página de debajo podía prerenderizarse por más
 * que su contenido fuera el mismo para todo el mundo. Ese único `await` costaba
 * el renderizado estático de la portada, del catálogo y de cada ficha de
 * carrera, que son las páginas que tienen que salir en Google.
 *
 * Ahora la lectura de sesión vive en `AccesoUsuario`, dentro de su propio
 * `<Suspense>`. La barra —marca y «Carreras»— entra en el armazón estático y se
 * pinta al instante; solo el par de enlaces de la derecha llega un momento
 * después.
 *
 * El hueco reservado tiene el ancho aproximado del contenido definitivo. Sin él,
 * el bloque aparece de golpe y empuja la barra al terminar de cargar.
 */
export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-linea bg-fondo/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3.5 sm:px-6 lg:px-10">
        <Marca />
        <nav className="flex items-center gap-3 text-sm font-semibold sm:gap-5">
          <Link href="/eventos" className="text-atenuado transition-colors hover:text-texto">
            Carreras
          </Link>
          <Suspense fallback={<span aria-hidden className="h-9 w-32" />}>
            <AccesoUsuario />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

async function AccesoUsuario() {
  const usuario = await getUsuarioActual();

  if (usuario) {
    // **A dónde lleva depende de quién sea.** Antes iba siempre a `/portal`, y
    // eso dejaba a los organizadores en una vía muerta: entraban bien al panel,
    // pero al volver al sitio público la única puerta les devolvía al portal de
    // corredor y no había ningún enlace a `/panel` en toda la aplicación.
    const ambito = await ambitoDelUsuario();

    // La cabecera acompaña a todas las pantallas: su botón nunca es el
    // primario, o competiría con la acción de cada una.
    return (
      <BotonEnlace variante="secundaria" tamano="sm" href={ambito.href}>
        {ambito.etiqueta}
      </BotonEnlace>
    );
  }

  return (
    <>
      <Link href="/login" className="text-atenuado transition-colors hover:text-texto">
        Entrar
      </Link>
      <BotonEnlace variante="secundaria" tamano="sm" href="/registro">
        Crear cuenta
      </BotonEnlace>
    </>
  );
}
