"use client";

import { useState, useTransition } from "react";
import { notificarSiguienteEnEspera, quitarDeListaEspera } from "../actions";
import { Boton } from "@/components/ui/Boton";

export function BotonNotificar({
  eventoId,
  categoriaId,
  categoria,
  hayEsperando,
  destacado = false,
}: {
  eventoId: string;
  categoriaId: string;
  categoria: string;
  hayEsperando: boolean;
  /**
   * Solo una cola por pantalla lleva el botón naranja. Con varias categorías
   * en espera, tres botones naranja no destacan ninguno; el resto avisa igual
   * pero en secundario.
   */
  destacado?: boolean;
}) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Boton variante={destacado ? "primaria" : "secundaria"} type="button" disabled={pendiente || !hayEsperando} title={!hayEsperando ? "No hay nadie esperando en esta categoría" : undefined} onClick={() => { setError(null); startTransition(async () => { try { await notificarSiguienteEnEspera(eventoId, categoriaId); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo notificar."); } }); }}>
        {pendiente ? "Avisando…" : `Avisar al siguiente de ${categoria}`}
      </Boton>
      {error && <p className="max-w-xs text-right text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function BotonQuitar({ eventoId, listaEsperaId }: { eventoId: string; listaEsperaId: string }) {
  const [pendiente, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() => {
        if (confirm("¿Quitar a esta persona de la lista de espera?")) {
          startTransition(() => quitarDeListaEspera(eventoId, listaEsperaId));
        }
      }}
      className="text-sm underline-offset-2 hover:underline disabled:opacity-50 text-red-400"
    >
      Quitar
    </button>
  );
}
