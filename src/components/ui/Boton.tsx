"use client";

import Link from "next/link";
import { useEffect } from "react";

export type VarianteBoton = "primaria" | "secundaria" | "fantasma" | "peligro";
export type TamanoBoton = "sm" | "md" | "lg";

/**
 * La primaria va en versalitas y peso 800: en el diseño aprobado la acción se
 * grita («INSCRIBIRME AHORA», «PAGAR L 503.00»). Las demás variantes acompañan
 * y se quedan en caja baja, que es lo que las hace secundarias.
 */
const VARIANTES: Record<VarianteBoton, string> = {
  primaria: "bg-naranja font-extrabold uppercase tracking-wide text-tinta hover:bg-naranja-suave",
  secundaria: "border border-linea-fuerte bg-superficie font-medium text-texto hover:border-texto/25",
  fantasma: "font-medium text-atenuado hover:bg-superficie-2 hover:text-texto",
  peligro: "border border-red-500/35 font-medium text-red-300 hover:bg-red-500/10",
};

/**
 * `h-11` son los 44px de área táctil que pide el diseño. Sube el ritmo vertical
 * respecto a los ~38px de antes, así que los formularios largos se leen más
 * espaciados: es intencionado.
 */
const TAMANOS: Record<TamanoBoton, string> = {
  sm: "h-9 px-3.5 text-xs",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-8 text-sm",
};

/* Radio de 6px: la píldora se reserva a chips y filtros. */
const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-55";

/**
 * Las mismas clases para un `<a>` corriente.
 *
 * Existe para los enlaces externos —el `wa.me` del organizador— que no pasan por
 * `next/link` y que, sin esto, acababan copiando la cadena a mano y separándose
 * del componente en cuanto alguien tocaba una.
 *
 * No dispara el aviso de la regla de oro: un enlace externo no es la acción de
 * la pantalla, es una salida de ella.
 */
export function claseBoton(
  variante: VarianteBoton = "secundaria",
  tamano: TamanoBoton = "md",
  extra = ""
) {
  return `${BASE} ${VARIANTES[variante]} ${TAMANOS[tamano]} ${extra}`.trim();
}

/* --------------------------------------------------------------------------
 * Regla de oro: un solo botón naranja por pantalla.
 *
 * Sobre 120 pantallas un comentario no aguanta, así que se avisa en consola.
 * El recuento se hace en el tick siguiente al montaje porque cuando se monta el
 * primer botón todavía no existen los demás. Solo en desarrollo.
 * ----------------------------------------------------------------------- */
let primariasMontadas = 0;
let comprobacion: ReturnType<typeof setTimeout> | null = null;

function useReglaDeOro(esPrimaria: boolean) {
  useEffect(() => {
    if (!esPrimaria || process.env.NODE_ENV === "production") return;
    primariasMontadas++;
    if (comprobacion) clearTimeout(comprobacion);
    comprobacion = setTimeout(() => {
      if (primariasMontadas > 1) {
        console.warn(
          `[RunTicket] ${primariasMontadas} botones primarios a la vez en esta pantalla. ` +
            `El naranja está reservado a UNA acción: los demás deberían ser "secundaria".`
        );
      }
    }, 0);
    return () => {
      primariasMontadas--;
    };
  }, [esPrimaria]);
}

type Comunes = {
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  /** Ocupa todo el ancho disponible: en móvil casi todos los CTA lo hacen. */
  ancho?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function Boton({
  variante = "secundaria",
  tamano = "md",
  ancho = false,
  className = "",
  children,
  ...props
}: Comunes & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  useReglaDeOro(variante === "primaria");
  return (
    <button
      {...props}
      className={`${BASE} ${VARIANTES[variante]} ${TAMANOS[tamano]} ${ancho ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

/** Mismo aspecto para los enlaces que actúan como acción (navegar a un flujo). */
export function BotonEnlace({
  variante = "secundaria",
  tamano = "md",
  ancho = false,
  className = "",
  children,
  ...props
}: Comunes & React.ComponentProps<typeof Link>) {
  useReglaDeOro(variante === "primaria");
  return (
    <Link
      {...props}
      className={`${BASE} ${VARIANTES[variante]} ${TAMANOS[tamano]} ${ancho ? "w-full" : ""} ${className}`}
    >
      {children}
    </Link>
  );
}
