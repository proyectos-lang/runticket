"use client";

import { useActionState } from "react";
import { Campo, CLASE_CAMPO } from "@/components/ui/Campo";
import { Select } from "@/components/ui/Select";
import { AreaTexto } from "@/components/ui/AreaTexto";
import { AceptacionDeclaracion } from "@/components/forms/AceptacionDeclaracion";
import { transferirInscripcion, type TransferenciaState } from "./actions";
import { Boton } from "@/components/ui/Boton";

const initialState: TransferenciaState = { status: "idle" };

export function TransferirForm({
  eventoId,
  inscripciones,
  declaracion,
}: {
  eventoId: string;
  inscripciones: { id: string; etiqueta: string }[];
  declaracion: { version: number; contenido: string };
}) {
  const [state, formAction, pending] = useActionState(
    transferirInscripcion.bind(null, eventoId),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
        <h3 className="text-base font-semibold text-texto">
          1. Inscripción a transferir
        </h3>
        <div className="flex flex-col gap-1">
          <label htmlFor="inscripcionId" className="text-sm font-medium text-atenuado">
            Corredor actual <span className="text-red-500">*</span>
          </label>
          <select id="inscripcionId" name="inscripcionId" required className={CLASE_CAMPO}>
            {inscripciones.map((i) => (
              <option key={i.id} value={i.id}>
                {i.etiqueta}
              </option>
            ))}
          </select>
          {state.errors?.inscripcionId?.[0] && (
            <p className="text-sm text-red-500">{state.errors.inscripcionId[0]}</p>
          )}
        </div>
        <p className="text-xs text-atenuado">
          El dorsal, la talla y el pago pasan a la persona nueva. La inscripción original queda
          marcada como transferida, con su declaración firmada intacta.
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
        <h3 className="text-base font-semibold text-texto">
          2. Quién recibe la inscripción
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nombres" name="nombres" required errors={state.errors?.nombres} />
          <Campo label="Apellidos" name="apellidos" required errors={state.errors?.apellidos} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Correo" name="correo" type="email" required errors={state.errors?.correo} />
          <Campo label="Teléfono" name="telefono" type="tel" errors={state.errors?.telefono} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Fecha de nacimiento"
            name="fechaNacimiento"
            type="date"
            required
            ayuda="Se valida contra el rango de edad de la categoría."
            errors={state.errors?.fechaNacimiento}
          />
          <Select
            label="Sexo"
            name="sexo"
            required
            opciones={[
              { valor: "masculino", etiqueta: "Masculino" },
              { valor: "femenino", etiqueta: "Femenino" },
              { valor: "otro", etiqueta: "Otro" },
            ]}
            errors={state.errors?.sexo}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Contacto de emergencia"
            name="contactoEmergenciaNombre"
            required
            errors={state.errors?.contactoEmergenciaNombre}
          />
          <Campo
            label="Teléfono de emergencia"
            name="contactoEmergenciaTelefono"
            type="tel"
            required
            errors={state.errors?.contactoEmergenciaTelefono}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
        <h3 className="text-base font-semibold text-texto">
          3. Declaración de salud
        </h3>
        <p className="text-sm text-atenuado">
          La declaración que aceptó el titular original no cubre a nadie más. Quien recibe la
          inscripción tiene que aceptarla por su cuenta, aquí y ahora.
        </p>
        <div className="max-h-48 overflow-y-auto whitespace-pre-line rounded-xl p-4 text-sm leading-relaxed bg-superficie-2 text-atenuado">
          {declaracion.contenido}
        </div>
        <AceptacionDeclaracion
          version={declaracion.version}
          enNombreDeOtro
          error={state.errors?.acepto?.[0]}
        />

        <AreaTexto
          label="Motivo (opcional)"
          name="motivo"
          rows={2}
          ayuda="Queda registrado junto a la transferencia."
          errors={state.errors?.motivo}
        />
      </section>

      {state.status === "error" && state.message && (
        <p className="rounded-lg px-4 py-3 text-sm bg-red-950 text-red-400">
          {state.message}
        </p>
      )}

      <Boton variante="primaria" type="submit" disabled={pending} className="self-start">
        {pending ? "Transfiriendo…" : "Transferir inscripción"}
      </Boton>
    </form>
  );
}
