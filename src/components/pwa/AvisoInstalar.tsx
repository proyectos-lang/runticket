"use client";

import { useEffect, useState } from "react";

/**
 * Invitación a instalar RunTicket como app.
 *
 * Dos caminos, porque no hay uno que valga para todos:
 *
 * · Chrome y Edge (Windows, macOS, Android) avisan con `beforeinstallprompt`
 *   cuando el sitio cumple los requisitos. Se guarda ese evento y el botón
 *   «Instalar» lo dispara: el navegador muestra su propio diálogo.
 *
 * · iPhone y iPad no tienen ese evento ni ningún diálogo automático: la única
 *   forma es Compartir → «Añadir a pantalla de inicio». Aquí solo se puede
 *   explicar cómo.
 *
 * No aparece si la app ya está instalada (`display-mode: standalone`) ni
 * durante un mes después de cerrarla con la X. Es un aviso, no una pancarta:
 * va abajo, pequeño, y nunca tapa un botón de acción.
 */
type EventoInstalar = Event & { prompt: () => Promise<void> };

const CLAVE = "runticket-instalar-cerrado";
const UN_MES = 30 * 24 * 60 * 60 * 1000;

export function AvisoInstalar() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [esIos, setEsIos] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const instalada =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari en iOS expone esto en vez del media query.
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (instalada) return;

    try {
      const cerrado = Number(localStorage.getItem(CLAVE) ?? 0);
      if (Date.now() - cerrado < UN_MES) return;
    } catch {
      // Sin localStorage (modo privado estricto) se muestra igual.
    }

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (ios) {
      // Con un respiro: que el aviso no sea lo primero que salta al abrir la
      // página, antes incluso de ver qué es RunTicket.
      const temporizador = window.setTimeout(() => {
        setEsIos(true);
        setVisible(true);
      }, 2500);
      return () => window.clearTimeout(temporizador);
    }

    const alPoderInstalar = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
      setVisible(true);
    };
    const alInstalar = () => setVisible(false);
    window.addEventListener("beforeinstallprompt", alPoderInstalar);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alPoderInstalar);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  if (!visible) return null;

  const cerrar = () => {
    setVisible(false);
    try {
      localStorage.setItem(CLAVE, String(Date.now()));
    } catch {
      // Sin almacenamiento, volverá a salir en la próxima visita.
    }
  };

  const instalar = async () => {
    if (!evento) return;
    await evento.prompt();
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Instalar la aplicación"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-linea bg-superficie/95 p-3 shadow-xl backdrop-blur sm:inset-x-auto sm:right-5 sm:bottom-5"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- icono estático, sin optimizar */}
      <img src="/icons/icon-maskable-192.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-texto">Lleva RunTicket en tu pantalla de inicio</p>
        <p className="text-xs leading-snug text-atenuado">
          {esIos
            ? "Toca Compartir y luego «Añadir a pantalla de inicio»."
            : "Tu dorsal y tus carreras, a un toque y sin abrir el navegador."}
        </p>
      </div>
      {!esIos && (
        <button
          type="button"
          onClick={instalar}
          className="shrink-0 rounded-full bg-naranja px-3.5 py-2 text-xs font-bold text-tinta transition-colors hover:bg-naranja-suave"
        >
          Instalar
        </button>
      )}
      <button
        type="button"
        onClick={cerrar}
        aria-label="Cerrar"
        className="shrink-0 rounded-full p-1.5 text-mudo transition-colors hover:bg-superficie-2 hover:text-texto"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
