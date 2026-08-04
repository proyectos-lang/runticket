"use client";

import { useActionState, useState, useTransition } from "react";
import { Campo } from "@/components/ui/Campo";
import { Select } from "@/components/ui/Select";
import { ChipEstado } from "@/components/ui/Chip";
import { formatPrecio, formatFechaCorta } from "@/lib/format";
import { guardarCupon, alternarCupon, eliminarCupon, type CuponState } from "./actions";
import { Boton } from "@/components/ui/Boton";

const initialState: CuponState = { status: "idle" };

export type Cupon = {
  id: string;
  codigo: string;
  evento_id: string | null;
  tipo_descuento: "porcentaje" | "monto_fijo";
  valor: number;
  usos_maximos: number | null;
  usos_actuales: number;
  vigente_desde: string | null;
  vigente_hasta: string | null;
  activo: boolean;
  vigenteDesdeLocal: string;
  vigenteHastaLocal: string;
};

function Formulario({
  cupon,
  eventos,
  moneda,
  onCerrar,
}: {
  cupon?: Cupon;
  eventos: { valor: string; etiqueta: string }[];
  moneda: string;
  onCerrar?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    guardarCupon.bind(null, cupon?.id ?? null),
    initialState
  );
  const [tipo, setTipo] = useState(cupon?.tipo_descuento ?? "porcentaje");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          label="Código"
          name="codigo"
          required
          placeholder="PREVENTA20"
          defaultValue={cupon?.codigo}
          ayuda="Es lo que teclea el corredor. Se guarda en mayúsculas."
          errors={state.errors?.codigo}
        />
        <Select
          label="Carrera"
          name="eventoId"
          placeholder="Todas las carreras"
          defaultValue={cupon?.evento_id ?? ""}
          opciones={eventos}
          errors={state.errors?.eventoId}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="tipoDescuento" className="text-sm font-medium text-atenuado">
            Tipo <span className="text-red-500">*</span>
          </label>
          <select
            id="tipoDescuento"
            name="tipoDescuento"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as typeof tipo)}
            className="rounded-lg border px-3 py-2 text-sm border-linea-fuerte bg-superficie text-texto"
          >
            <option value="porcentaje">Porcentaje</option>
            <option value="monto_fijo">Monto fijo</option>
          </select>
        </div>
        <Campo
          label={tipo === "porcentaje" ? "Descuento (%)" : `Descuento (${moneda})`}
          name="valor"
          type="number"
          step="0.01"
          min="0"
          max={tipo === "porcentaje" ? 100 : undefined}
          required
          defaultValue={cupon?.valor ?? ""}
          errors={state.errors?.valor}
        />
        <Campo
          label="Usos máximos"
          name="usosMaximos"
          type="number"
          min="1"
          placeholder="Sin límite"
          defaultValue={cupon?.usos_maximos ?? ""}
          errors={state.errors?.usosMaximos}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          label="Vigente desde"
          name="vigenteDesde"
          type="datetime-local"
          defaultValue={cupon?.vigenteDesdeLocal}
          ayuda="Opcional. Vacío = desde ya."
          errors={state.errors?.vigenteDesde}
        />
        <Campo
          label="Vigente hasta"
          name="vigenteHasta"
          type="datetime-local"
          defaultValue={cupon?.vigenteHastaLocal}
          ayuda="Opcional. Vacío = sin caducidad."
          errors={state.errors?.vigenteHasta}
        />
      </div>

      {state.status === "error" && state.message && (
        <p className="text-sm text-red-400">{state.message}</p>
      )}
      {state.status === "guardado" && (
        <p className="text-sm text-emerald-400">Cupón guardado.</p>
      )}

      <div className="flex gap-2">
        <Boton variante="primaria" type="submit" disabled={pending}>
          {pending ? "Guardando…" : cupon ? "Guardar cambios" : "Crear cupón"}
        </Boton>
        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-full border px-5 py-2.5 text-sm font-medium border-linea-fuerte text-atenuado hover:bg-superficie-2"
          >
            {state.status === "guardado" ? "Cerrar" : "Cancelar"}
          </button>
        )}
      </div>
    </form>
  );
}

export function GestorCupones({
  cupones,
  eventos,
  moneda,
}: {
  cupones: Cupon[];
  eventos: { valor: string; etiqueta: string }[];
  moneda: string;
}) {
  const [editando, setEditando] = useState<string | null>(null);
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

  const ahora = new Date().toISOString();

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p className="rounded-lg px-3 py-2 text-sm bg-red-950 text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {cupones.map((c) => {
          if (editando === c.id) {
            return (
              <div
                key={c.id}
                className="rounded-2xl border p-5 border-linea-fuerte bg-superficie"
              >
                <Formulario
                  cupon={c}
                  eventos={eventos}
                  moneda={moneda}
                  onCerrar={() => setEditando(null)}
                />
              </div>
            );
          }

          const agotado = c.usos_maximos !== null && c.usos_actuales >= c.usos_maximos;
          const caducado = c.vigente_hasta !== null && c.vigente_hasta < ahora;
          const sinEmpezar = c.vigente_desde !== null && c.vigente_desde > ahora;
          const estado = !c.activo
            ? { etiqueta: "Desactivado", tono: "neutro" as const }
            : agotado
              ? { etiqueta: "Agotado", tono: "error" as const }
              : caducado
                ? { etiqueta: "Caducado", tono: "error" as const }
                : sinEmpezar
                  ? { etiqueta: "Aún no empieza", tono: "aviso" as const }
                  : { etiqueta: "Activo", tono: "exito" as const };

          return (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4 border-linea bg-superficie"
            >
              <div>
                <p className="flex items-center gap-2 font-mono text-base font-semibold text-texto">
                  {c.codigo}
                  <ChipEstado estilo={estado} />
                </p>
                <p className="mt-0.5 text-sm text-atenuado">
                  {c.tipo_descuento === "porcentaje"
                    ? `${c.valor} % de descuento`
                    : `${formatPrecio(Number(c.valor), moneda)} de descuento`}
                  {" · "}
                  {eventos.find((e) => e.valor === c.evento_id)?.etiqueta ?? "Todas las carreras"}
                  {" · "}
                  {c.usos_actuales}
                  {c.usos_maximos !== null ? `/${c.usos_maximos}` : ""} usos
                  {c.vigente_hasta && ` · hasta ${formatFechaCorta(c.vigente_hasta)}`}
                </p>
              </div>
              <div className="flex gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setEditando(c.id);
                  }}
                  className="underline-offset-2 hover:underline text-atenuado"
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => ejecutar(() => alternarCupon(c.id, !c.activo))}
                  className="underline-offset-2 hover:underline disabled:opacity-50 text-atenuado"
                >
                  {c.activo ? "Desactivar" : "Activar"}
                </button>
                <button
                  type="button"
                  disabled={pendiente || c.usos_actuales > 0}
                  title={c.usos_actuales > 0 ? "Ya se usó: solo se puede desactivar" : undefined}
                  onClick={() => {
                    if (confirm(`¿Eliminar el cupón ${c.codigo}?`)) {
                      ejecutar(() => eliminarCupon(c.id));
                    }
                  }}
                  className="underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40 text-red-400"
                >
                  Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-2xl border p-6 border-linea bg-superficie">
        <h3 className="mb-4 text-base font-semibold text-texto">Crear cupón</h3>
        <Formulario eventos={eventos} moneda={moneda} />
      </section>
    </div>
  );
}
