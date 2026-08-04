"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen, esImagenSoportada, type OpcionesCompresion } from "@/lib/imagenes/comprimir";

export type ResultadoSubida = { url: string; ruta: string };

/**
 * Sube directamente del navegador a Storage, no por Server Action: las acciones
 * topan en 1 MB y una foto de móvil no cabe. Además, al ir con el JWT del
 * usuario, las políticas del bucket (que exigen que la primera carpeta sea el
 * empresa_id) se evalúan de verdad.
 */
export function SubidorImagen({
  bucket,
  carpeta,
  prefijo,
  preset,
  etiqueta,
  multiple = false,
  onSubido,
}: {
  bucket: string;
  /** Debe empezar por el empresa_id: es lo que comprueba la política del bucket. */
  carpeta: string;
  prefijo: string;
  preset: OpcionesCompresion;
  etiqueta: string;
  multiple?: boolean;
  onSubido: (resultados: ResultadoSubida[]) => void | Promise<void>;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function manejar(archivos: FileList | null) {
    if (!archivos?.length) return;
    setError(null);
    setSubiendo(true);

    const lista = [...archivos];
    const resultados: ResultadoSubida[] = [];
    const supabase = createClient();

    try {
      for (const [i, archivo] of lista.entries()) {
        setProgreso({ hechas: i, total: lista.length });

        if (!esImagenSoportada(archivo)) {
          throw new Error(
            `"${archivo.name}" no es una imagen compatible. Usa JPG, PNG, WebP o AVIF.` +
              (archivo.name.toLowerCase().endsWith(".heic")
                ? " Las fotos HEIC del iPhone deben exportarse como JPG."
                : "")
          );
        }

        const { blob, extension } = await comprimirImagen(archivo, preset);
        const ruta = `${carpeta}/${prefijo}-${Date.now()}-${i}.${extension}`;

        const { error: errorSubida } = await supabase.storage
          .from(bucket)
          .upload(ruta, blob, { contentType: blob.type });
        if (errorSubida) throw new Error(errorSubida.message);

        const { data } = supabase.storage.from(bucket).getPublicUrl(ruta);
        resultados.push({ url: data.publicUrl, ruta });
      }

      await onSubido(resultados);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    } finally {
      setSubiendo(false);
      setProgreso(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-atenuado">{etiqueta}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple={multiple}
          disabled={subiendo}
          onChange={(e) => {
            void manejar(e.target.files);
            e.target.value = "";
          }}
          className="text-sm disabled:opacity-60 text-atenuado"
        />
      </label>

      {subiendo && (
        <p className="text-sm text-atenuado">
          {progreso && progreso.total > 1
            ? `Subiendo ${progreso.hechas + 1} de ${progreso.total}…`
            : "Comprimiendo y subiendo…"}
        </p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <p className="text-xs text-atenuado">
        Se reduce y convierte a WebP automáticamente antes de subirla.
      </p>
    </div>
  );
}
