"use client";

import Link from "next/link";

/**
 * Chip de filtro.
 *
 * Activo = placa blanca sobre negro, NO naranja. El naranja está reservado a la
 * acción, y una fila de siete filtros con uno en naranja compite con el botón
 * de inscripción, que es lo único que la pantalla quiere que se pulse.
 *
 * El realce no cambia el grosor del borde: pasar de 1px a 1.5px mueve el
 * contenido medio píxel y todo el grupo «salta» al elegir. Va con
 * `box-shadow: inset`, que no ocupa espacio.
 */
const BASE = "inline-flex h-9 shrink-0 items-center gap-1.5 border px-3.5 text-xs font-semibold transition-colors";
const ACTIVA = "border-texto bg-texto text-fondo shadow-[inset_0_0_0_1px_var(--color-texto)]";
const INACTIVA = "border-linea-fuerte text-atenuado hover:border-texto/25 hover:text-texto";

function clases(activa: boolean, forma: "pildora" | "cuadrada", extra: string) {
  const radio = forma === "cuadrada" ? "rounded-md" : "rounded-full";
  return `${BASE} ${radio} ${activa ? ACTIVA : INACTIVA} ${extra}`;
}

export function Pildora({
  activa = false,
  forma = "pildora",
  children,
  className = "",
  ...props
}: {
  activa?: boolean;
  forma?: "pildora" | "cuadrada";
  children: React.ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-pressed={activa} {...props} className={clases(activa, forma, className)}>
      {children}
    </button>
  );
}

/**
 * La misma píldora cuando el filtro es un enlace (estado en la URL, no en React).
 *
 * Va con `next/link` y no con un `<a>` crudo: estas píldoras son los filtros del
 * listado público, de la home, de la bitácora y de las pestañas del portal, y con
 * un ancla normal cada clic recargaba el documento entero —incluida la barra
 * lateral y la cabecera— para cambiar una sola consulta.
 */
export function PildoraEnlace({
  activa = false,
  forma = "pildora",
  href,
  children,
  className = "",
  ...props
}: {
  activa?: boolean;
  forma?: "pildora" | "cuadrada";
  href: string;
  children: React.ReactNode;
  className?: string;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link
      href={href}
      aria-current={activa ? "true" : undefined}
      {...props}
      className={clases(activa, forma, className)}
    >
      {children}
    </Link>
  );
}
