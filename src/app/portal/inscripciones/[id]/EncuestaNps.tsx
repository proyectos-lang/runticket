"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { EtiquetaMono } from "@/components/ui/Datos";
import { CLASE_AREA } from "@/components/ui/Campo";
import type { EncuestaState } from "./actions";

const initialState: EncuestaState = { status: "idle" };

const NOTAS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * La encuesta post-evento, pedida dentro del producto (9.5).
 *
 * Sin correos, la única forma de que esto tenga respuesta es aparecer donde el
 * corredor ya está mirando. Por eso vive en su ficha de inscripción y junto a su
 * resultado, y no en una pantalla propia a la que habría que llevarlo.
 *
 * **Un solo paso.** La escala 0-10 es la pregunta entera; el comentario es
 * opcional y solo se despliega cuando ya hay nota elegida, para que el bloque no
 * parezca un formulario largo antes de haber empezado. Un cuestionario de varias
 * páginas aquí no lo termina nadie.
 *
 * La nota elegida se marca como el resto de estados seleccionados del sistema
 * —borde naranja sobre fondo tenue—, que no es lo mismo que una placa naranja.
 * Y el botón de enviar se queda en secundaria a propósito: este bloque convive
 * con el de pago, que en una carrera ya corrida puede seguir reclamando dinero,
 * y el naranja pleno de la pantalla le pertenece a él.
 */
export function EncuestaNps({
  responder,
  evento,
}: {
  responder: (prev: EncuestaState, formData: FormData) => Promise<EncuestaState>;
  evento: string;
}) {
  const [estado, accion, enviando] = useActionState(responder, initialState);
  const [nota, setNota] = useState<number | null>(null);

  if (estado.status === "enviada") {
    return (
      <section className="flex flex-col gap-2 rounded-2xl border border-linea bg-superficie p-6">
        <EtiquetaMono>Gracias</EtiquetaMono>
        <p className="text-sm text-atenuado">
          Tu opinión ya llegó al organizador de {evento}. Le sirve para la próxima edición.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-linea bg-superficie p-6">
      <div>
        <EtiquetaMono>Tu opinión</EtiquetaMono>
        <h2 className="mt-1.5 text-lg font-semibold text-texto">
          ¿Recomendarías {evento} a otro corredor?
        </h2>
        <p className="mt-1 text-sm text-atenuado">
          Del 0 al 10. Es anónimo para el organizador: verá la nota y el comentario, no quién los
          escribió.
        </p>
      </div>

      <form action={accion} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Elige una nota del 0 al 10</legend>
          <div className="flex flex-wrap gap-1.5">
            {NOTAS.map((n) => (
              <label
                key={n}
                className={`tabular inline-flex size-11 cursor-pointer items-center justify-center rounded-md border font-mono text-sm font-semibold transition-colors ${
                  nota === n
                    ? "border-naranja bg-naranja/6 text-texto"
                    : "border-linea-fuerte text-atenuado hover:border-texto/25 hover:text-texto"
                }`}
              >
                <input
                  type="radio"
                  name="puntaje"
                  value={n}
                  checked={nota === n}
                  onChange={() => setNota(n)}
                  className="sr-only"
                  required
                />
                {n}
              </label>
            ))}
          </div>
          <div className="flex justify-between font-mono text-[0.625rem] uppercase tracking-etiqueta text-mudo">
            <span>Nada probable</span>
            <span>Muy probable</span>
          </div>
        </fieldset>

        {/* El comentario aparece cuando ya hay nota: antes es una caja vacía que
            solo consigue que el bloque parezca más trabajo del que es. */}
        {nota !== null && (
          <label className="flex flex-col gap-1.5">
            <EtiquetaMono>Qué mejorarías (opcional)</EtiquetaMono>
            <textarea
              name="comentario"
              rows={3}
              maxLength={600}
              placeholder="La salida, el avituallamiento, la entrega de kits…"
              className={CLASE_AREA}
            />
          </label>
        )}

        {estado.status === "error" && <Aviso tono="rojo">{estado.message}</Aviso>}

        <Boton type="submit" disabled={enviando || nota === null}>
          {enviando ? "Enviando…" : "Enviar mi opinión"}
        </Boton>
      </form>
    </section>
  );
}
