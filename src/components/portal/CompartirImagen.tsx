"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/Boton";

/**
 * «Compartir»: pide la imagen al servidor y la entrega a la hoja de compartir
 * del teléfono (Instagram, WhatsApp…) con la Web Share API. Donde no exista
 * —escritorio, navegadores viejos— se descarga el PNG, que es lo siguiente
 * mejor: la persona lo sube a mano.
 *
 * Dos formatos porque las redes no admiten el mismo: historia (9:16) y
 * publicación (1:1). El botón no es el primario de la pantalla: compartir es
 * un extra, la acción principal sigue siendo la de cada página.
 */
export function CompartirImagen({
  url,
  nombreArchivo,
  titulo,
  texto,
}: {
  /** Ruta de la imagen, sin `?formato=`. */
  url: string;
  nombreArchivo: string;
  titulo: string;
  texto: string;
}) {
  const [ocupado, setOcupado] = useState<"historia" | "cuadrado" | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function compartir(formato: "historia" | "cuadrado") {
    setOcupado(formato);
    setMensaje(null);
    try {
      const r = await fetch(`${url}?formato=${formato}`);
      if (!r.ok) throw new Error((await r.text()) || "No se pudo generar la imagen.");
      const blob = await r.blob();
      const archivo = new File([blob], `${nombreArchivo}-${formato}.png`, { type: "image/png" });

      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [archivo] })) {
        try {
          await navigator.share({ files: [archivo], title: titulo, text: texto });
          return;
        } catch (e) {
          // Cerrar la hoja de compartir no es un error.
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      }
      const enlace = document.createElement("a");
      enlace.href = URL.createObjectURL(blob);
      enlace.download = archivo.name;
      enlace.click();
      URL.revokeObjectURL(enlace.href);
      setMensaje("Imagen descargada. Súbela a tu historia o publicación.");
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No se pudo generar la imagen.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Boton
          type="button"
          variante="secundaria"
          disabled={ocupado !== null}
          onClick={() => compartir("historia")}
          className="flex-1"
        >
          {ocupado === "historia" ? "Preparando…" : "Compartir historia"}
        </Boton>
        <Boton
          type="button"
          variante="secundaria"
          disabled={ocupado !== null}
          onClick={() => compartir("cuadrado")}
          className="flex-1"
        >
          {ocupado === "cuadrado" ? "Preparando…" : "Compartir publicación"}
        </Boton>
      </div>
      {mensaje && <p className="text-center text-xs text-atenuado">{mensaje}</p>}
    </div>
  );
}
