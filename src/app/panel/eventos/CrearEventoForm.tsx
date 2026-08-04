"use client";

import { useActionState, useState } from "react";
import { Campo } from "@/components/ui/Campo";
import { generarSlug } from "@/lib/slug";
import { crearEvento, type CrearEventoState } from "./actions";
import { Boton } from "@/components/ui/Boton";

const initialState: CrearEventoState = { status: "idle" };

export function CrearEventoForm() {
  const [state, formAction, pending] = useActionState(crearEvento, initialState);
  const [slug, setSlug] = useState("");
  /**
   * En cuanto alguien edita el slug a mano, el nombre deja de sobrescribirlo.
   * Sin esto, corregir una tilde del nombre al final borraría la dirección que
   * la persona acababa de ajustar, y encima sin avisar.
   */
  const [aMano, setAMano] = useState(false);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie"
    >
      <h2 className="text-lg font-semibold text-texto">Nuevo evento</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Nombre del evento"
          name="nombre"
          required
          placeholder="20 Millas de Easy Count"
          onChange={(v) => {
            if (!aMano) setSlug(generarSlug(v));
          }}
          errors={state.errors?.nombre}
        />
        <Campo
          label="Identificador de URL"
          name="slug"
          // Sin `required`: el servidor lo deriva del nombre si llega vacío, y
          // marcarlo obligatorio impedía el gesto natural de borrarlo para que
          // se vuelva a generar.
          value={slug}
          onChange={(v) => {
            setAMano(true);
            // Normalización ligera: se corrigen mayúsculas y espacios, que son
            // el error habitual, pero no se recorta más. Si aquí se aplicara el
            // generador completo no se podría ni teclear un guion, porque
            // desaparecería en cuanto se escribiera.
            setSlug(v.toLowerCase().replace(/\s+/g, "-"));
          }}
          ayuda={
            slug ? `Quedará en /eventos/${slug}` : "Déjalo vacío y se genera desde el nombre."
          }
          errors={state.errors?.slug}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Fecha y hora de inicio" name="fechaInicio" type="datetime-local" required errors={state.errors?.fechaInicio} />
        <Campo
          label="Fecha límite de inscripción"
          name="fechaLimiteInscripcion"
          type="datetime-local"
          errors={state.errors?.fechaLimiteInscripcion}
        />
      </div>
      <Campo label="Dirección" name="direccion" errors={state.errors?.direccion} />
      <div className="flex flex-col gap-1">
        <label htmlFor="descripcion" className="text-sm font-medium text-atenuado">
          Descripción
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={4}
          className="rounded-lg border px-3 py-2 text-sm outline-none border-linea-fuerte bg-superficie text-texto focus:border-texto/25"
        />
        {state.errors?.descripcion?.[0] && <p className="text-sm text-red-500">{state.errors.descripcion[0]}</p>}
      </div>

      {state.status === "error" && state.message && (
        <p className="rounded-lg px-3 py-2 text-sm bg-red-950 text-red-400">
          {state.message}
        </p>
      )}

      <Boton variante="primaria" type="submit" disabled={pending} className="self-start">
        {pending ? "Creando…" : "Crear evento (borrador)"}
      </Boton>
    </form>
  );
}
