import Image from "next/image";
import { Marca } from "./Marca";

/**
 * Isotipo sobre el logotipo, apilados.
 *
 * Se reserva a las pantallas donde la marca **es** el contenido y hay sitio de
 * sobra: acceso, registro y recuperación de contraseña. En la cabecera pública o
 * en el menú del panel no entra, porque son barras densas donde el logotipo
 * solo ya identifica de sobra y el icono no añadiría información, solo estorbo.
 *
 * El PNG lleva fondo transparente, no negro: el fondo del sistema es `#07080A`,
 * no negro puro, y un rectángulo negro se recortaría contra la página.
 *
 * `priority` porque está sobre el pliegue de la primera pantalla que ve alguien
 * sin sesión; cargarlo en diferido dejaría un hueco justo donde mira.
 */
export function MarcaVertical() {
  return (
    <div className="flex flex-col items-center gap-4">
      <Image
        src="/isotipo.png"
        alt=""
        width={512}
        height={512}
        priority
        // Decorativo: el nombre lo dice el logotipo de debajo, que ya es un
        // enlace con su propia etiqueta. Repetirlo obligaría a quien usa lector
        // de pantalla a oír la marca dos veces seguidas.
        aria-hidden
        className="h-20 w-auto sm:h-24"
      />
      <Marca className="text-3xl" />
    </div>
  );
}
