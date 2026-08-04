"use client";

import { useState } from "react";

/**
 * Delegar el retiro del kit en otra persona.
 *
 * Usa la hoja de compartir del sistema cuando existe, y cae a copiar al
 * portapapeles cuando no: en escritorio `navigator.share` no está, y sin el
 * respaldo el enlace sería un texto muerto.
 */
export function CompartirRetiro({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function compartir() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Retiro de kit · RunTicket", text: texto });
        return;
      } catch {
        // El usuario canceló la hoja: no es un error que haya que contarle.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <button
      type="button"
      onClick={compartir}
      className="underline underline-offset-2 transition-colors hover:text-texto"
    >
      {copiado ? "Copiado al portapapeles" : "compartiendo este código"}
    </button>
  );
}
