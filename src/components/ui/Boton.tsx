"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  BASE,
  TAMANOS,
  VARIANTES,
  type TamanoBoton,
  type VarianteBoton,
} from "./estilosBoton";

export type { VarianteBoton, TamanoBoton };

/**
 * `claseBoton` **ya no se exporta desde aquí**: vive en `./estilosBoton`, que no
 * es un módulo de cliente. Exportarla desde este archivo la convertía en una
 * referencia al cliente, y llamarla desde un componente de servidor lanzaba
 * «Attempted to call claseBoton() from the server» al renderizar, sin que el
 * build dijera nada.
 */

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
