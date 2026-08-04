"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { SubidorImagen } from "@/components/forms/SubidorImagen";
import { PRESETS } from "@/lib/imagenes/comprimir";
import {
  guardarBanner,
  quitarBanner,
  agregarImagenes,
  eliminarImagen,
  moverImagen,
} from "../actions";

export function GestorImagenes({
  eventoId,
  carpeta,
  banner,
  galeria,
}: {
  eventoId: string;
  /** `{empresa_id}/{evento_id}`: la política del bucket exige ese prefijo. */
  carpeta: string;
  banner: string | null;
  galeria: { id: string; url: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function ejecutar(accion: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await accion();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p className="rounded-lg px-3 py-2 text-sm bg-red-950 text-red-400">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-texto">Portada</h3>
          <p className="text-sm text-atenuado">
            Es la imagen que encabeza la página del evento y la que se ve al compartir el enlace
            por WhatsApp. Apaisada funciona mejor.
          </p>
        </div>

        {banner ? (
          <div className="flex flex-col gap-3">
            <div className="relative aspect-[21/9] w-full overflow-hidden rounded-xl bg-superficie-2">
              <Image src={banner} alt="Portada del evento" fill sizes="(max-width: 1024px) 100vw, 800px" className="object-cover" />
            </div>
            <button
              type="button"
              disabled={pendiente}
              onClick={() => {
                if (confirm("¿Quitar la portada?")) ejecutar(() => quitarBanner(eventoId));
              }}
              className="self-start text-sm underline-offset-2 hover:underline disabled:opacity-50 text-red-400"
            >
              Quitar portada
            </button>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed px-6 py-8 text-center text-sm border-linea-fuerte text-atenuado">
            Sin portada. El evento se verá sin imagen en el listado y al compartirlo.
          </p>
        )}

        <SubidorImagen
          bucket="eventos"
          carpeta={carpeta}
          prefijo="banner"
          preset={PRESETS.banner}
          etiqueta={banner ? "Reemplazar portada" : "Subir portada"}
          onSubido={async ([r]) => {
            if (r) await guardarBanner(eventoId, r.url);
          }}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-texto">
            Galería ({galeria.length})
          </h3>
          <p className="text-sm text-atenuado">
            Fotos de ediciones anteriores, del recorrido o del kit. Se muestran en el orden que
            fijes aquí.
          </p>
        </div>

        {galeria.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {galeria.map((img, i) => (
              <figure key={img.id} className="flex flex-col gap-1">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-superficie-2">
                  <Image src={img.url} alt="" fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover" />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pendiente || i === 0}
                      onClick={() => ejecutar(() => moverImagen(eventoId, img.id, -1))}
                      aria-label="Mover antes"
                      className="disabled:opacity-30 text-atenuado"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      disabled={pendiente || i === galeria.length - 1}
                      onClick={() => ejecutar(() => moverImagen(eventoId, img.id, 1))}
                      aria-label="Mover después"
                      className="disabled:opacity-30 text-atenuado"
                    >
                      →
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => {
                      if (confirm("¿Eliminar esta imagen?")) {
                        ejecutar(() => eliminarImagen(eventoId, img.id));
                      }
                    }}
                    className="underline-offset-2 hover:underline disabled:opacity-50 text-red-400"
                  >
                    Eliminar
                  </button>
                </div>
              </figure>
            ))}
          </div>
        )}

        <SubidorImagen
          bucket="eventos"
          carpeta={carpeta}
          prefijo="galeria"
          preset={PRESETS.galeria}
          etiqueta="Añadir imágenes"
          multiple
          onSubido={async (resultados) => {
            if (resultados.length) await agregarImagenes(eventoId, resultados.map((r) => r.url));
          }}
        />
      </section>
    </div>
  );
}
