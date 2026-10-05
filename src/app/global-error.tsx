"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Último recurso: solo se muestra si falla el propio layout raíz. Por eso trae
 * su `<html>` y su `<body>`, importa los estilos globales por su cuenta y no
 * usa ningún componente del sistema: aquí no se puede dar nada por cargado.
 * Sin este archivo, ese caso enseñaba la pantalla de Next en inglés y sin estilo.
 */
export default function ErrorGlobal({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Error en el layout raíz:", error);
  }, [error]);

  return (
    <html lang="es">
      <head>
        <title>Algo se rompió · RunTicket HN</title>
      </head>
      <body className="flex min-h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
          <span className="font-mono text-[0.625rem] font-bold uppercase tracking-etiqueta text-mudo">Error</span>
          <h1 className="display max-w-140 text-2xl text-texto">Algo se rompió por nuestra parte</h1>
          <p className="max-w-140 text-sm leading-relaxed text-atenuado">
            No es culpa tuya. Vuelve a intentarlo; si sigue fallando, avísanos indicando qué estabas haciendo.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="rounded-full border border-linea-fuerte px-5 py-2.5 text-sm font-semibold text-texto transition-colors hover:bg-superficie-2"
            >
              Reintentar
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a propósito:
                si el layout raíz falló, el enrutador puede no estar vivo; un enlace
                normal fuerza una carga limpia. */}
            <a
              href="/"
              className="rounded-full border border-linea-fuerte px-5 py-2.5 text-sm font-semibold text-atenuado transition-colors hover:bg-superficie-2 hover:text-texto"
            >
              Ir al inicio
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
