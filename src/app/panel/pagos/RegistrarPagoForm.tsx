"use client";

import { useActionState, useState } from "react";
import { Campo } from "@/components/ui/Campo";
import { Select } from "@/components/ui/Select";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Aviso";
import { formatPrecio } from "@/lib/format";
import { registrarPagoManual, type PagoManualState } from "./actions";

const initialState: PagoManualState = { status: "idle" };

export type InscripcionPorCobrar = {
  id: string;
  corredor: string;
  evento: string;
  categoria: string;
  dorsal: number | null;
  monto: number;
  moneda: string;
};

const METODOS = [
  { valor: "efectivo", etiqueta: "Efectivo" },
  { valor: "manual", etiqueta: "Registro manual (transferencia ya conciliada)" },
];

/**
 * Registra un cobro que ocurrió fuera de la plataforma.
 *
 * La lista trae **solo las inscripciones que aún no tienen un pago confirmado**:
 * el organizador que está en el mostrador busca a quien acaba de pagarle, no a
 * los que ya pagaron. Eso también mantiene el desplegable en un tamaño usable
 * sin necesidad de un buscador.
 *
 * Al elegir a alguien, el monto se rellena con lo que debe. Es editable porque
 * los cobros en efectivo admiten ajustes —un descuento acordado, un redondeo—,
 * pero el valor por defecto evita teclearlo y equivocarse.
 */
export function RegistrarPagoForm({
  inscripciones,
  destacado,
}: {
  inscripciones: InscripcionPorCobrar[];
  /** El botón va en naranja solo si no hay cola de comprobantes compitiendo. */
  destacado: boolean;
}) {
  const [state, formAction, pending] = useActionState(registrarPagoManual, initialState);
  const [inscripcionId, setInscripcionId] = useState("");

  const elegida = inscripciones.find((i) => i.id === inscripcionId);

  // Ojo con el orden: al registrar el último cobro pendiente la lista se queda
  // vacía y esta rama sustituye al formulario. Por eso el aviso de éxito se
  // pinta también aquí; si no, el organizador cobraría y no vería confirmación
  // alguna, justo en la acción donde más falta hace.
  if (inscripciones.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {state.status === "registrado" && (
          <Aviso tono="verde">
            Cobro registrado. El dorsal se asigna solo en cuanto el pago queda confirmado.
          </Aviso>
        )}
        <p className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm border-linea-fuerte text-atenuado">
          Todas las inscripciones activas tienen su cobro confirmado. Cuando alguien se inscriba y
          pague en efectivo, podrás registrarlo aquí.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border p-5 border-linea bg-superficie">
      <Select
        label="Inscripción"
        name="inscripcionId"
        required
        opciones={inscripciones.map((i) => ({
          valor: i.id,
          etiqueta: `${i.dorsal ? `#${i.dorsal} · ` : ""}${i.corredor} · ${i.evento} · ${i.categoria} · ${formatPrecio(i.monto, i.moneda)}`,
        }))}
        placeholder="Busca al corredor…"
        onChange={setInscripcionId}
        ayuda={`${inscripciones.length} ${inscripciones.length === 1 ? "inscripción sin cobro confirmado" : "inscripciones sin cobro confirmado"}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Método" name="metodo" required opciones={METODOS} defaultValue="efectivo" />
        <Campo
          label="Monto"
          name="monto"
          type="number"
          step="0.01"
          min="0"
          required
          // `key` fuerza a React a recrear el campo al cambiar de inscripción:
          // sin ella, el `defaultValue` nuevo no se aplicaría sobre un campo que
          // el usuario ya tocó.
          key={inscripcionId}
          defaultValue={elegida ? String(elegida.monto) : ""}
          ayuda={elegida ? `Debe ${formatPrecio(elegida.monto, elegida.moneda)}` : "Se rellena al elegir."}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Referencia"
          name="referencia"
          placeholder="N.º de recibo o de transferencia"
          ayuda="Opcional. Sirve para cuadrar con tu contabilidad."
        />
        <Campo label="Notas" name="notas" placeholder="Pagó en la tienda" ayuda="Opcional." />
      </div>

      {state.status === "error" && state.message && <Aviso tono="rojo">{state.message}</Aviso>}
      {state.status === "registrado" && (
        <Aviso tono="verde">
          Cobro registrado. El dorsal se asigna solo en cuanto el pago queda confirmado.
        </Aviso>
      )}

      <Boton
        variante={destacado ? "primaria" : "secundaria"}
        type="submit"
        disabled={pending}
        className="self-start"
      >
        {pending ? "Registrando…" : "Registrar cobro"}
      </Boton>
    </form>
  );
}
