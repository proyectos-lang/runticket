"use client";

import { useActionState, useState, useTransition } from "react";
import { Campo } from "@/components/ui/Campo";
import { Select } from "@/components/ui/Select";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Aviso";
import { EtiquetaMono } from "@/components/ui/Datos";
import { PARENTESCOS } from "@/lib/validacion/acompanantes";
import { TALLAS } from "@/lib/validacion/perfil";
import { formatFechaCorta } from "@/lib/format";
import { guardarAcompanante, quitarAcompanante, type AcompananteState } from "./actions";

const initialState: AcompananteState = { status: "idle" };

export type Acompanante = {
  id: string;
  parentesco: "hijo" | "pareja" | "familiar" | "otro";
  nombres: string | null;
  apellidos: string | null;
  fechaNacimiento: string | null;
  sexo: "masculino" | "femenino" | "otro" | null;
  correo: string | null;
  documentoIdentidad: string | null;
  talla: string | null;
  contactoEmergenciaNombre: string | null;
  contactoEmergenciaTelefono: string | null;
  /** Carreras en las que ya está inscrito; condiciona si se puede quitar. */
  inscripciones: number;
  edad: number | null;
};

const ETIQUETA_PARENTESCO = Object.fromEntries(PARENTESCOS.map((p) => [p.valor, p.etiqueta]));

function Formulario({
  acompanante,
  onCerrar,
}: {
  acompanante?: Acompanante;
  onCerrar?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    guardarAcompanante.bind(null, acompanante?.id ?? null),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Nombres"
          name="nombres"
          required
          defaultValue={acompanante?.nombres ?? ""}
          errors={state.errors?.nombres}
        />
        <Campo
          label="Apellidos"
          name="apellidos"
          required
          defaultValue={acompanante?.apellidos ?? ""}
          errors={state.errors?.apellidos}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo
          label="Fecha de nacimiento"
          name="fechaNacimiento"
          type="date"
          required
          defaultValue={acompanante?.fechaNacimiento ?? ""}
          ayuda="Define en qué categoría puede correr."
          errors={state.errors?.fechaNacimiento}
        />
        <Select
          label="Sexo"
          name="sexo"
          required
          defaultValue={acompanante?.sexo ?? ""}
          opciones={[
            { valor: "femenino", etiqueta: "Femenino" },
            { valor: "masculino", etiqueta: "Masculino" },
            { valor: "otro", etiqueta: "Otro" },
          ]}
          errors={state.errors?.sexo}
        />
        <Select
          label="Parentesco"
          name="parentesco"
          required
          defaultValue={acompanante?.parentesco ?? "hijo"}
          opciones={PARENTESCOS.map((p) => ({ valor: p.valor, etiqueta: p.etiqueta }))}
          errors={state.errors?.parentesco}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          label="Talla habitual"
          name="tallaPredeterminada"
          defaultValue={acompanante?.talla ?? ""}
          opciones={TALLAS.map((t) => ({ valor: t, etiqueta: t }))}
          placeholder="Sin definir"
          ayuda="Se puede cambiar al inscribir."
          errors={state.errors?.tallaPredeterminada}
        />
        <Campo
          label="Documento de identidad"
          name="documentoIdentidad"
          defaultValue={acompanante?.documentoIdentidad ?? ""}
          errors={state.errors?.documentoIdentidad}
        />
        <Campo
          label="Correo"
          name="correo"
          type="email"
          defaultValue={acompanante?.correo ?? ""}
          ayuda="Opcional. Con correo podrá tener su propio acceso algún día."
          errors={state.errors?.correo}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Contacto de emergencia"
          name="contactoEmergenciaNombre"
          defaultValue={acompanante?.contactoEmergenciaNombre ?? ""}
          errors={state.errors?.contactoEmergenciaNombre}
        />
        <Campo
          label="Teléfono de emergencia"
          name="contactoEmergenciaTelefono"
          defaultValue={acompanante?.contactoEmergenciaTelefono ?? ""}
          errors={state.errors?.contactoEmergenciaTelefono}
        />
      </div>

      {state.status === "error" && state.message && <Aviso tono="rojo">{state.message}</Aviso>}
      {state.status === "guardado" && <Aviso tono="verde">Guardado.</Aviso>}

      <div className="flex flex-wrap gap-2">
        <Boton variante="primaria" type="submit" disabled={pending}>
          {pending ? "Guardando…" : acompanante ? "Guardar cambios" : "Añadir acompañante"}
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

export function GestorAcompanantes({ acompanantes }: { acompanantes: Acompanante[] }) {
  const [editando, setEditando] = useState<string | null>(null);
  const [anadiendo, setAnadiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      {error && <Aviso tono="rojo">{error}</Aviso>}

      {acompanantes.length === 0 && !anadiendo ? (
        <p className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm border-linea-fuerte text-atenuado">
          Todavía no has añadido a nadie. Aquí guardas a quien inscribes contigo —tus hijos, tu
          pareja— para no volver a escribir sus datos en cada carrera.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {acompanantes.map((a) => (
            <div key={a.id} className="rounded-2xl border p-5 border-linea bg-superficie">
              {editando === a.id ? (
                <Formulario acompanante={a} onCerrar={() => setEditando(null)} />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <p className="font-semibold text-texto">
                      {[a.nombres, a.apellidos].filter(Boolean).join(" ")}
                    </p>
                    <p className="tabular font-mono text-[0.65625rem] uppercase tracking-etiqueta text-texto/45">
                      {[
                        ETIQUETA_PARENTESCO[a.parentesco],
                        a.edad !== null && `${a.edad} años`,
                        a.talla && `Talla ${a.talla}`,
                        a.fechaNacimiento && formatFechaCorta(a.fechaNacimiento),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {a.inscripciones > 0 && (
                      <EtiquetaMono>
                        {a.inscripciones} {a.inscripciones === 1 ? "carrera" : "carreras"}
                      </EtiquetaMono>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setEditando(a.id);
                      }}
                      className="underline-offset-2 hover:underline text-atenuado"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={pendiente}
                      onClick={() => {
                        const aviso =
                          a.inscripciones > 0
                            ? `¿Quitar a ${a.nombres} de tu lista? Sus ${a.inscripciones} inscripciones, dorsales y resultados se conservan; solo dejará de aparecer al inscribir.`
                            : `¿Quitar a ${a.nombres} de tu lista?`;
                        if (!confirm(aviso)) return;
                        setError(null);
                        startTransition(async () => {
                          try {
                            await quitarAcompanante(a.id);
                          } catch (e) {
                            setError(e instanceof Error ? e.message : "No se pudo quitar.");
                          }
                        });
                      }}
                      className="underline-offset-2 hover:underline disabled:opacity-50 text-red-400"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {anadiendo ? (
        <section className="rounded-2xl border p-6 border-linea bg-superficie">
          <h2 className="mb-4 text-base font-semibold text-texto">Nuevo acompañante</h2>
          <Formulario onCerrar={() => setAnadiendo(false)} />
        </section>
      ) : (
        <Boton variante="primaria" onClick={() => setAnadiendo(true)} className="self-start">
          Añadir acompañante
        </Boton>
      )}
    </div>
  );
}
