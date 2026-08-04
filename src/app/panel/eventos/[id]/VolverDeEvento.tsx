"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Enlace de vuelta de la cabecera del evento.
 *
 * Antes apuntaba siempre al listado de carreras, así que desde «Imágenes» o
 * «Categorías» el atrás te sacaba del evento entero y había que volver a
 * entrar para seguir configurándolo. Ahora sube **un solo nivel**: de una
 * sub-pantalla al centro de mando de la carrera, y solo desde ahí al listado.
 *
 * Vive en un componente de cliente porque el layout es de servidor y no puede
 * saber en qué sub-pantalla está; `usePathname` es lo único que hace falta.
 */
export function VolverDeEvento({ eventoId }: { eventoId: string }) {
  const pathname = usePathname();
  const base = `/panel/eventos/${eventoId}`;
  const enSubpantalla = pathname !== base;

  return (
    <Link
      href={enSubpantalla ? base : "/panel/eventos"}
      className="text-sm text-mudo transition-colors hover:text-texto"
    >
      {enSubpantalla ? "← Volver a la carrera" : "← Carreras"}
    </Link>
  );
}
