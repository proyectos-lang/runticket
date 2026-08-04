"use client";

import { useState } from "react";
import { formatPrecio, formatDistancia, formatRangoEdad } from "@/lib/format";
import { BotonEnlace } from "@/components/ui/Boton";
import { RadioFila } from "@/components/ui/RadioFila";
import { EtiquetaMono } from "@/components/ui/Datos";
import type { CategoriaConCupo } from "@/lib/eventos/consultas";

/**
 * Elegir distancia y ver el total en el mismo sitio. La barra de compra se
 * queda pegada abajo porque en móvil la lista de categorías empuja el botón
 * fuera de la pantalla y el corredor tendría que volver a subir para pulsarlo.
 */
export function SelectorDistancia({
  slug,
  categorias,
  moneda,
  abierto,
}: {
  slug: string;
  categorias: CategoriaConCupo[];
  moneda: string;
  /** Falso cuando el evento está cerrado, cancelado o ya se celebró. */
  abierto: boolean;
}) {
  const disponibles = categorias.filter((c) => c.cupos_disponibles === null || c.cupos_disponibles > 0);
  const [id, setId] = useState(disponibles[0]?.id ?? "");
  const elegida = categorias.find((c) => c.id === id) ?? null;

  if (!categorias.length) {
    return (
      <p className="rounded-xl border border-dashed border-linea-fuerte px-5 py-8 text-center text-sm text-atenuado">
        El organizador todavía no publicó las categorías.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <EtiquetaMono>Elige tu distancia</EtiquetaMono>

      <div className="flex flex-col gap-2 pb-20 lg:pb-0">
        {categorias.map((c) => {
          const agotada = c.cupos_disponibles !== null && c.cupos_disponibles <= 0;
          const condicion = [
            c.hora_salida && `Salida ${c.hora_salida.slice(0, 5)}`,
            typeof c.desnivel_m === "number" && `+${c.desnivel_m.toLocaleString("es-HN")} m`,
            formatRangoEdad(c.edad_minima, c.edad_maxima),
            agotada
              ? "Agotada"
              : c.cupos_disponibles === null
                ? "Cupo abierto"
                : `${c.cupos_disponibles} plazas libres`,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <RadioFila
              key={c.id}
              name="categoria"
              value={c.id}
              checked={id === c.id}
              disabled={agotada}
              onChange={setId}
              titulo={
                <span className="flex flex-wrap items-baseline gap-2">
                  {c.nombre}
                  {c.distancia_km !== null && (
                    <span className="tabular font-mono text-xs text-cian">
                      {formatDistancia(c.distancia_km)}
                    </span>
                  )}
                </span>
              }
              detalle={<span className="tabular font-mono text-xs">{condicion}</span>}
              derecha={
                <span
                  className={`tabular text-[1.0625rem] font-extrabold ${
                    id === c.id ? "text-naranja" : "text-texto"
                  }`}
                >
                  {formatPrecio(Number(c.precio_vigente), moneda)}
                </span>
              }
            />
          );
        })}
      </div>

      {/*
        Pegajosa solo hasta `lg`. En móvil la lista de categorías empuja el
        botón fuera de la pantalla y el corredor tendría que volver a subir;
        en escritorio la lista entera cabe a la vista y una barra fija encima
        del contenido solo taparía las primeras filas.

        `z-20`: por encima del contenido, por debajo de la cabecera, que va en
        z-30.
      */}
      <div className="sticky bottom-0 z-20 -mx-6 flex items-center justify-between gap-4 border-t border-linea bg-fondo/95 px-6 py-3.5 backdrop-blur lg:static lg:mx-0 lg:rounded-xl lg:border lg:bg-superficie lg:px-5">
        <div className="flex flex-col">
          <EtiquetaMono>Total</EtiquetaMono>
          <span className="tabular text-xl font-extrabold tracking-display text-texto">
            {elegida ? formatPrecio(Number(elegida.precio_vigente), moneda) : "—"}
          </span>
        </div>
        {abierto && elegida ? (
          <BotonEnlace
            href={`/eventos/${slug}/inscripcion?categoria=${elegida.id}`}
            variante="primaria"
            tamano="lg"
          >
            Inscribirme
          </BotonEnlace>
        ) : (
          <span className="text-sm text-atenuado">
            {abierto ? "Sin plazas disponibles" : "Inscripciones cerradas"}
          </span>
        )}
      </div>
    </div>
  );
}
