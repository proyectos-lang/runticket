"use client";

import { useEffect } from "react";

/**
 * Mantiene la pantalla encendida mientras se muestra el código de retiro.
 *
 * El diseño pide subir el brillo al máximo, pero la web no tiene ninguna API
 * para eso —ningún navegador la expone, por motivos de seguridad—. Lo que sí
 * existe es Wake Lock, que resuelve el problema real: el corredor tiene el
 * código abierto en la cola y la pantalla se le apaga justo cuando llega su
 * turno. Se libera solo al salir.
 */
export function PantallaDespierta() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let bloqueo: WakeLockSentinel | null = null;
    let cancelado = false;

    async function pedir() {
      try {
        const b = await navigator.wakeLock.request("screen");
        if (cancelado) void b.release();
        else bloqueo = b;
      } catch {
        // Denegado o no disponible (batería baja, pestaña en segundo plano).
        // No es un fallo que merezca molestar al corredor.
      }
    }
    void pedir();

    // Al volver de segundo plano el sistema libera el bloqueo por su cuenta.
    function alVolver() {
      if (document.visibilityState === "visible" && !bloqueo) void pedir();
    }
    document.addEventListener("visibilitychange", alVolver);

    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", alVolver);
      void bloqueo?.release();
    };
  }, []);

  return null;
}
