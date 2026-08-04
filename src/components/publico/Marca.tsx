import Link from "next/link";

/**
 * Logotipo de RunTicket HN.
 *
 * Se compone con tipografía y no con una imagen: el logotipo es puro texto, así
 * que dibujarlo con la fuente que la aplicación ya carga sale nítido a cualquier
 * tamaño y en cualquier pantalla, no añade una descarga y hereda los colores del
 * sistema. Un PNG habría que servirlo en varias resoluciones y se vería borroso
 * al ampliarlo.
 *
 * Tres piezas, como en el logotipo: `Run` en blanco, `Ticket` con el degradado
 * naranja y `HN` en azul, más pequeño y elevado.
 *
 * No cuenta para la regla del botón naranja único: es marca, no acción.
 */
export function Marca({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="RunTicket HN, inicio"
      // No usa `.display`: esa clase impone `text-transform: uppercase` y, al
      // estar fuera de las capas de Tailwind, gana a cualquier `normal-case`
      // que se le ponga al lado. El logotipo lleva mayúscula solo en la R y la
      // T, así que se componen aquí las tres propiedades que sí interesan.
      className={`shrink-0 font-black italic leading-none tracking-display-fuerte text-texto ${className}`}
    >
      Run
      {/*
        El degradado se recorta contra el texto. Va de arriba abajo, del naranja
        suave al naranja fuerte, que son los dos tonos que el sistema ya usa: así
        el logotipo no introduce colores que no existan en el resto de la interfaz.
      */}
      <span className="bg-gradient-to-b from-naranja-suave to-naranja bg-clip-text text-transparent">
        Ticket
      </span>
      {/*
        `HN` es la marca de país, no parte del nombre: va en azul, a media altura
        y algo más pequeño, como en el logotipo. `aria-hidden` no: forma parte del
        nombre leído, y ya está en el `aria-label` del enlace.
      */}
      <span className="ml-0.5 align-super text-[0.62em] text-azul">HN</span>
    </Link>
  );
}
