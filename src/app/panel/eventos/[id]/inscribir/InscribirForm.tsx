"use client";

import { useActionState, useState } from "react";
import { Campo, CLASE_CAMPO } from "@/components/ui/Campo";
import { Select } from "@/components/ui/Select";
import { AceptacionDeclaracion } from "@/components/forms/AceptacionDeclaracion";
import { formatPrecio } from "@/lib/format";
import { inscribirManualmente, type ManualState } from "./actions";
import { Boton } from "@/components/ui/Boton";

const initialState: ManualState = { status: "idle" };

export function InscribirForm({
  eventoId,
  moneda,
  categorias,
  tallas,
  declaracion,
}: {
  eventoId: string;
  moneda: string;
  categorias: { id: string; nombre: string; precio: number; cuposLibres: number | null }[];
  tallas: string[];
  declaracion: { version: number; contenido: string };
}) {
  const [state, formAction, pending] = useActionState(
    inscribirManualmente.bind(null, eventoId),
    initialState
  );
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [nacimiento, setNacimiento] = useState("");

  const seleccionada = categorias.find((c) => c.id === categoriaId);
  // La edad se calcula igual que en la base de datos: la que tendrá el día del evento.
  const esMenor = nacimiento
    ? new Date().getFullYear() - new Date(nacimiento).getFullYear() < 18
    : false;

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
        <h3 className="text-base font-semibold text-texto">1. Categoría</h3>
        <div className="flex flex-col gap-1">
          <label htmlFor="categoriaId" className="text-sm font-medium text-atenuado">
            Categoría <span className="text-red-500">*</span>
          </label>
          <select
            id="categoriaId"
            name="categoriaId"
            required
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className={CLASE_CAMPO}
          >
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} · {formatPrecio(c.precio, moneda)}
                {c.cuposLibres !== null ? ` · ${c.cuposLibres} libres` : ""}
              </option>
            ))}
          </select>
          {state.errors?.categoriaId?.[0] && (
            <p className="text-sm text-red-500">{state.errors.categoriaId[0]}</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
        <h3 className="text-base font-semibold text-texto">2. Datos del corredor</h3>
        <p className="-mt-2 text-sm text-atenuado">
          Si el correo ya tiene cuenta, se usa esa. Si no, se le crea una para que pueda ver su
          dorsal y su certificado.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nombres" name="nombres" required errors={state.errors?.nombres} />
          <Campo label="Apellidos" name="apellidos" required errors={state.errors?.apellidos} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Correo" name="correo" type="email" required errors={state.errors?.correo} />
          <Campo label="Teléfono" name="telefono" type="tel" errors={state.errors?.telefono} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Controlado: de su valor depende que aparezca el bloque del tutor. */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="fechaNacimiento"
              className="text-sm font-medium text-atenuado"
            >
              Fecha de nacimiento <span className="text-red-500">*</span>
            </label>
            <input
              id="fechaNacimiento"
              name="fechaNacimiento"
              type="date"
              required
              value={nacimiento}
              onChange={(e) => setNacimiento(e.target.value)}
              className={CLASE_CAMPO}
            />
            {state.errors?.fechaNacimiento?.[0] && (
              <p className="text-sm text-red-500">{state.errors.fechaNacimiento[0]}</p>
            )}
          </div>
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
          <Campo
            label="Documento de identidad"
            name="documentoIdentidad"
            errors={state.errors?.documentoIdentidad}
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

        {tallas.length > 0 && (
          <Select
            label="Talla"
            name="talla"
            placeholder="Sin talla"
            opciones={tallas.map((t) => ({ valor: t, etiqueta: t }))}
            errors={state.errors?.talla}
          />
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
        <h3 className="text-base font-semibold text-texto">
          3. Declaración de salud
        </h3>
        <div className="max-h-48 overflow-y-auto whitespace-pre-line rounded-xl p-4 text-sm leading-relaxed bg-superficie-2 text-atenuado">
          {declaracion.contenido}
        </div>
        <p className="text-xs text-atenuado">
          Versión {declaracion.version}. Muéstrale el texto completo al corredor antes de
          confirmar; su aceptación queda registrada con fecha, hora, IP y dispositivo.
        </p>

        {esMenor && (
          <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 border-amber-900 bg-amber-950/30">
            <Campo label="Nombre del tutor" name="tutorNombre" errors={state.errors?.tutorNombre} />
            <Campo label="Documento del tutor" name="tutorDocumento" errors={state.errors?.tutorDocumento} />
          </div>
        )}

        {/* Sin nombre: los campos de arriba no están controlados y aquí se
            hablaría de una persona cuyo nombre podría estar a medio escribir. */}
        <AceptacionDeclaracion
          version={declaracion.version}
          enNombreDeOtro
          error={state.errors?.acepto?.[0]}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
        <h3 className="text-base font-semibold text-texto">4. Cobro</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Precio"
            name="precio"
            type="number"
            step="0.01"
            min="0"
            placeholder={seleccionada ? String(seleccionada.precio) : ""}
            ayuda="Déjalo vacío para cobrar el precio vigente."
            errors={state.errors?.precio}
          />
          <label className="flex items-start gap-3 self-end pb-2 text-sm text-atenuado">
            <input type="checkbox" name="cobrarEfectivo" value="on" defaultChecked className="mt-0.5" />
            <span>
              Cobrado en efectivo ahora
              <span className="block text-xs text-atenuado">
                Marca el pago como recibido y asigna el dorsal al instante.
              </span>
            </span>
          </label>
        </div>
      </section>

      {state.status === "error" && state.message && (
        <p className="rounded-lg px-4 py-3 text-sm bg-red-950 text-red-400">
          {state.message}
        </p>
      )}

      <Boton variante="primaria" type="submit" disabled={pending} className="self-start">
        {pending ? "Inscribiendo…" : "Inscribir"}
      </Boton>
    </form>
  );
}
