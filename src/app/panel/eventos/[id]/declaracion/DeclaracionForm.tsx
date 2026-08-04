"use client";

import { useActionState } from "react";
import { AreaTexto } from "@/components/ui/AreaTexto";
import { publicarDeclaracion, type DeclaracionState } from "./actions";
import { Boton } from "@/components/ui/Boton";

const initialState: DeclaracionState = { status: "idle" };

export function DeclaracionForm({
  eventoId,
  contenidoActual,
  ambitoActual,
  firmasExistentes,
}: {
  eventoId: string;
  contenidoActual: string;
  ambitoActual: "evento" | "empresa";
  /** Cuántas personas ya firmaron la versión vigente. */
  firmasExistentes: number;
}) {
  const [state, formAction, pending] = useActionState(
    publicarDeclaracion.bind(null, eventoId),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {firmasExistentes > 0 && (
        <p className="rounded-lg px-4 py-3 text-sm bg-amber-950/30 text-amber-300">
          {firmasExistentes} {firmasExistentes === 1 ? "persona ya firmó" : "personas ya firmaron"} la
          versión vigente. Al publicar se crea una versión nueva: las firmas anteriores siguen
          asociadas al texto que esas personas aceptaron, no al nuevo.
        </p>
      )}

      <AreaTexto
        label="Texto de la declaración"
        name="contenido"
        rows={18}
        required
        defaultValue={contenidoActual}
        ayuda="Es el documento que el corredor firma antes de inscribirse. Conviene que lo revise un abogado."
      />

      <label className="flex items-start gap-3 text-sm text-atenuado">
        <input
          type="checkbox"
          name="soloEsteEvento"
          value="on"
          defaultChecked={ambitoActual === "evento"}
          className="mt-1"
        />
        <span>
          Usar solo en esta carrera
          <span className="block text-xs text-atenuado">
            Sin marcar, el texto pasa a ser el predeterminado de todas tus carreras.
          </span>
        </span>
      </label>

      {state.status === "error" && (
        <p className="rounded-lg px-3 py-2 text-sm bg-red-950 text-red-400">
          {state.message}
        </p>
      )}
      {state.status === "guardado" && (
        <p className="rounded-lg px-3 py-2 text-sm bg-emerald-950 text-emerald-400">
          Versión publicada. Las inscripciones nuevas firmarán este texto.
        </p>
      )}

      <Boton variante="primaria" type="submit" disabled={pending} className="self-start">
        {pending ? "Publicando…" : "Publicar versión nueva"}
      </Boton>
    </form>
  );
}
