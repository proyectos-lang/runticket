"use client";

import { useActionState, useState, useTransition } from "react";
import { Campo } from "@/components/ui/Campo";
import { Select } from "@/components/ui/Select";
import { Boton } from "@/components/ui/Boton";
import { ChipEstado } from "@/components/ui/Chip";
import { EtiquetaMono } from "@/components/ui/Datos";
import { formatFechaCorta } from "@/lib/format";
import {
  guardarInsignia,
  alternarInsignia,
  eliminarInsignia,
  repartirInsignias,
  TIPOS_CRITERIO,
  type InsigniaState,
} from "./actions";
import type { CriterioInsignia, TipoCriterioInsignia } from "@/lib/supabase/database.types";

const initialState: InsigniaState = { status: "idle" };

export type Insignia = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  icono_url: string | null;
  criterio: CriterioInsignia;
  activa: boolean;
  created_at: string;
  /** Cuántos corredores la tienen ya; decide si se puede borrar. */
  concedidas: number;
};

export function describirCriterio(c: CriterioInsignia): string {
  const n = c.minimo;
  switch (c.tipo) {
    case "carreras_completadas":
      return `Completar ${n} ${n === 1 ? "carrera tuya" : "carreras tuyas"}`;
    case "distancia_acumulada":
      return `Acumular ${n} km en tus carreras`;
    case "distancia_en_una_carrera":
      return `Completar una carrera tuya de ${n} km o más`;
    case "anos_distintos":
      return `Correr contigo en ${n} ${n === 1 ? "año" : "años"} distintos`;
  }
}

function Formulario({ insignia, onCerrar }: { insignia?: Insignia; onCerrar?: () => void }) {
  const [state, formAction, pending] = useActionState(
    guardarInsignia.bind(null, insignia?.id ?? null),
    initialState
  );
  const [tipo, setTipo] = useState<TipoCriterioInsignia>(
    insignia?.criterio.tipo ?? "carreras_completadas"
  );

  const definicion = TIPOS_CRITERIO.find((t) => t.valor === tipo)!;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          label="Nombre"
          name="nombre"
          required
          placeholder="Fiel a la casa"
          defaultValue={insignia?.nombre}
          ayuda="Es lo que ve el corredor en su perfil."
          errors={state.errors?.nombre}
        />
        <Campo
          label="Código"
          name="codigo"
          required
          placeholder="FIEL-3"
          defaultValue={insignia?.codigo}
          ayuda="Identificador interno. Se guarda en mayúsculas."
          errors={state.errors?.codigo}
        />
      </div>

      <Campo
        label="Descripción"
        name="descripcion"
        placeholder="Tres carreras con nosotros. Gracias por volver."
        defaultValue={insignia?.descripcion ?? ""}
        errors={state.errors?.descripcion}
      />

      <Campo
        label="URL del icono"
        name="iconoUrl"
        placeholder="https://…"
        defaultValue={insignia?.icono_url ?? ""}
        ayuda="Opcional. Sin icono se muestra la inicial del nombre."
        errors={state.errors?.iconoUrl}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Cómo se gana"
          name="tipo"
          required
          value={tipo}
          onChange={(v) => setTipo(v as TipoCriterioInsignia)}
          opciones={TIPOS_CRITERIO.map((t) => ({ valor: t.valor, etiqueta: t.etiqueta }))}
          ayuda={definicion.ayuda}
          errors={state.errors?.tipo}
        />
        <Campo
          label={`Umbral (${definicion.unidad})`}
          name="minimo"
          type="number"
          step="0.1"
          min="0"
          required
          defaultValue={insignia?.criterio.minimo ?? ""}
          errors={state.errors?.minimo}
        />
      </div>

      {state.status === "error" && state.message && (
        <p className="text-sm text-red-400">{state.message}</p>
      )}
      {state.status === "guardado" && <p className="text-sm text-emerald-400">Insignia guardada.</p>}

      <div className="flex gap-2">
        <Boton variante="primaria" type="submit" disabled={pending}>
          {pending ? "Guardando…" : insignia ? "Guardar cambios" : "Crear insignia"}
        </Boton>
        {onCerrar && (
          <Boton type="button" onClick={onCerrar}>
            {state.status === "guardado" ? "Cerrar" : "Cancelar"}
          </Boton>
        )}
      </div>
    </form>
  );
}

export function GestorInsignias({
  insignias,
  eventosFinalizados,
}: {
  insignias: Insignia[];
  /** Para repartir una insignia recién creada entre carreras ya cerradas. */
  eventosFinalizados: { id: string; nombre: string }[];
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function ejecutar(accion: () => Promise<void>, exito?: string) {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      try {
        await accion();
        if (exito) setAviso(exito);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-400">{error}</p>}
      {aviso && <p className="rounded-lg bg-emerald-950 px-3 py-2 text-sm text-emerald-400">{aviso}</p>}

      <div className="flex flex-col gap-3">
        {insignias.map((i) => {
          if (editando === i.id) {
            return (
              <div key={i.id} className="rounded-2xl border border-linea-fuerte bg-superficie p-5">
                <Formulario insignia={i} onCerrar={() => setEditando(null)} />
              </div>
            );
          }

          return (
            <div
              key={i.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-linea bg-superficie px-5 py-4"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-texto">
                  {i.nombre}
                  <span className="font-mono text-xs text-mudo">{i.codigo}</span>
                  <ChipEstado
                    estilo={
                      i.activa
                        ? { etiqueta: "Activa", tono: "exito" }
                        : { etiqueta: "Desactivada", tono: "neutro" }
                    }
                  />
                </p>
                <p className="mt-0.5 text-sm text-atenuado">
                  {describirCriterio(i.criterio)}
                  {" · "}
                  {i.concedidas} {i.concedidas === 1 ? "corredor la tiene" : "corredores la tienen"}
                  {" · desde "}
                  {formatFechaCorta(i.created_at)}
                </p>
              </div>
              <div className="flex gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setEditando(i.id);
                  }}
                  className="text-atenuado underline-offset-2 hover:underline"
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => ejecutar(() => alternarInsignia(i.id, !i.activa))}
                  className="text-atenuado underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {i.activa ? "Desactivar" : "Activar"}
                </button>
                <button
                  type="button"
                  disabled={pendiente || i.concedidas > 0}
                  title={i.concedidas > 0 ? "Ya la ganaron: solo se puede desactivar" : undefined}
                  onClick={() => {
                    if (confirm(`¿Eliminar la insignia ${i.nombre}?`)) {
                      ejecutar(() => eliminarInsignia(i.id));
                    }
                  }}
                  className="text-red-400 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-2xl border border-linea bg-superficie p-6">
        <h3 className="mb-4 text-base font-semibold text-texto">Crear insignia</h3>
        <Formulario />
      </section>

      {/* Las insignias se conceden solas al dar una carrera por finalizada. Esto
          cubre el caso de crear una cuando ya hay carreras cerradas: sin ello
          habría que reabrir y volver a cerrar una carrera para que llegara a
          quien ya se la había ganado. */}
      {insignias.length > 0 && eventosFinalizados.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-linea bg-superficie p-6">
          <EtiquetaMono>Repartir en carreras ya cerradas</EtiquetaMono>
          <p className="text-sm text-atenuado">
            Las insignias se conceden solas cuando marcas una carrera como finalizada. Si acabas de
            crear una, aquí la repartes entre quienes ya cumplían el criterio.
          </p>
          <div className="flex flex-wrap gap-2">
            {eventosFinalizados.map((e) => (
              <Boton
                key={e.id}
                type="button"
                tamano="sm"
                disabled={pendiente}
                onClick={() =>
                  ejecutar(() => repartirInsignias(e.id), `Repartidas las de ${e.nombre}.`)
                }
              >
                {e.nombre}
              </Boton>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
