"use client";

import { useEffect } from "react";

/**
 * Registra el service worker (public/sw.js). No pinta nada.
 *
 * `updateViaCache: "none"` hace que el navegador compruebe siempre si hay una
 * versión nueva del archivo en vez de reutilizar la cacheada.
 */
export function RegistroSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((e) => console.warn("No se pudo registrar el service worker", e));
  }, []);
  return null;
}
