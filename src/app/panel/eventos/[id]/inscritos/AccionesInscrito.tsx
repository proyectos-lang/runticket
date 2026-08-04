"use client";

import { useState, useTransition } from "react";
import { cambiarCategoriaInscrito, cambiarTallaInscrito, anularInscripcion } from "./actions";

export function AccionesInscrito({
  eventoId,
  inscripcionId,
  nombre,
  categoriaActual,
  tallaActual,
  categorias,
  tallas,
  kitEntregado,
}: {
  eventoId: string;
  inscripcionId: string;
  nombre: string;
  categoriaActual: string;
  tallaActual: string | null;
  categorias: { id: string; nombre: string }[];
  tallas: string[];
  kitEntregado: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
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

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-sm underline-offset-2 hover:underline text-atenuado"
      >
        Gestionar
      </button>
    );
  }

  const clase =
    "rounded-lg border px-2 py-1 text-sm disabled:opacity-60 border-linea-fuerte bg-superficie text-texto";

  return (
    <div className="flex min-w-56 flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs text-atenuado">
        Categoría
        <select
          value={categoriaActual}
          disabled={pendiente}
          onChange={(e) => ejecutar(() => cambiarCategoriaInscrito(eventoId, inscripcionId, e.target.value))}
          className={clase}
        >
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-atenuado">
        Talla
        <select
          value={tallaActual ?? ""}
          disabled={pendiente || kitEntregado}
          title={kitEntregado ? "El kit ya se entregó" : undefined}
          onChange={(e) =>
            ejecutar(() => cambiarTallaInscrito(eventoId, inscripcionId, e.target.value || null))
          }
          className={clase}
        >
          <option value="">Sin talla</option>
          {tallas.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1 border-t pt-2 border-linea">
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo de la anulación"
          aria-label="Motivo de la anulación"
          className={clase}
        />
        <button
          type="button"
          disabled={pendiente}
          onClick={() => {
            if (confirm(`¿Anular la inscripción de ${nombre}? Se liberará su cupo y su talla.`)) {
              ejecutar(() => anularInscripcion(eventoId, inscripcionId, motivo));
            }
          }}
          className="rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50 border-red-900 text-red-400 hover:bg-red-950"
        >
          Anular inscripción
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="button"
        onClick={() => setAbierto(false)}
        className="self-start text-xs underline-offset-2 hover:underline text-atenuado"
      >
        Cerrar
      </button>
    </div>
  );
}
