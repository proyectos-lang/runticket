"use client";

import { useSyncExternalStore } from "react";

/** El reloj es un sistema externo: se suscribe una vez por minuto. */
function suscribir(alCambiar: () => void) {
  const id = setInterval(alCambiar, 60_000);
  return () => clearInterval(id);
}

/** Minuto actual como entero: cambia solo cuando hay algo que repintar. */
const minutoActual = () => Math.floor(Date.now() / 60_000);

export function CuentaRegresiva({ fecha }: { fecha: string }) {
  // En el servidor devuelve null para que el HTML inicial no dependa del reloj y
  // no haya desajuste de hidratación; el valor real llega tras el montaje.
  const minuto = useSyncExternalStore(suscribir, minutoActual, () => null);
  if (minuto === null) return null;

  const ms = new Date(fecha).getTime() - minuto * 60_000;
  if (ms <= 0) return null;

  const bloques = [
    { valor: Math.floor(ms / 86_400_000), etiqueta: "Días" },
    { valor: Math.floor((ms / 3_600_000) % 24), etiqueta: "Horas" },
    { valor: Math.floor((ms / 60_000) % 60), etiqueta: "Minutos" },
  ];

  return (
    <div className="flex gap-2.5">
      {bloques.map((b) => (
        <div
          key={b.etiqueta}
          className="flex flex-1 flex-col items-center gap-1 rounded-lg border border-linea bg-superficie-2 px-3 py-3.5"
        >
          <span className="tabular font-mono text-3xl font-extrabold tracking-display text-texto">
            {b.valor}
          </span>
          <span className="font-mono text-[0.625rem] font-semibold uppercase tracking-etiqueta text-mudo">
            {b.etiqueta}
          </span>
        </div>
      ))}
    </div>
  );
}
