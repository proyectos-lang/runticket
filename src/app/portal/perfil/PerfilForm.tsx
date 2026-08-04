"use client";

import { useActionState, useState } from "react";
import { Campo } from "@/components/ui/Campo";
import { Select } from "@/components/ui/Select";
import { SelectorGeografico } from "@/components/forms/SelectorGeografico";
import {
  TIPOS_SANGRE,
  TALLAS,
  NIVELES_EXPERIENCIA,
  ORIGENES,
} from "@/lib/validacion/perfil";
import { guardarPerfil, type PerfilState } from "./actions";
import { Boton } from "@/components/ui/Boton";

const initialState: PerfilState = { status: "idle" };

type PerfilRow = {
  nombres: string | null;
  apellidos: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  sexo: string | null;
  documento_identidad: string | null;
  pais_id: string | null;
  departamento_id: string | null;
  ciudad_id: string | null;
  nacionalidad: string | null;
  talla_predeterminada: string | null;
  tipo_sangre: string | null;
  contacto_emergencia_nombre: string | null;
  contacto_emergencia_parentesco: string | null;
  contacto_emergencia_telefono: string | null;
  ocupacion: string | null;
  como_se_entero: string | null;
  nivel_experiencia: string | null;
};

const aOpciones = (valores: readonly string[]) => valores.map((v) => ({ valor: v, etiqueta: v }));

const SEXO_LABEL: Record<string, string> = {
  femenino: "Femenino",
  masculino: "Masculino",
  otro: "Otro",
};

/**
 * Categoría que le corresponde al corredor, derivada de sexo y edad.
 *
 * Se muestra pero no se pide: pedirla invitaría a equivocarse, y el organizador
 * la valida igualmente contra la fecha de nacimiento al inscribirse. Los tramos
 * de cinco años son la convención de atletismo máster.
 */
function calcularCategoria(sexo: string | null, nacimiento: string | null): string {
  if (!sexo || !nacimiento) return "Completa tu sexo y tu fecha de nacimiento";
  const nac = new Date(nacimiento);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const mes = hoy.getMonth() - nac.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) edad--;
  if (edad < 0) return "Revisa tu fecha de nacimiento";

  const desde = Math.floor(edad / 5) * 5;
  const tramo = edad < 18 ? "Menor de 18" : `${desde}–${desde + 4} años`;
  return `${SEXO_LABEL[sexo] ?? sexo} · ${tramo}`;
}

export function PerfilForm({
  perfil,
  paises,
  next,
}: {
  perfil: PerfilRow;
  paises: { id: string; nombre: string }[];
  next?: string;
}) {
  const [state, formAction, pending] = useActionState(guardarPerfil, initialState);

  // Se recalcula en vivo al cambiar sexo o nacimiento, que es lo que el aviso
  // de abajo promete.
  const [sexo, setSexo] = useState(perfil.sexo ?? "");
  const [nacimiento, setNacimiento] = useState(perfil.fecha_nacimiento ?? "");
  const categoriaCalculada = calcularCategoria(sexo, nacimiento);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {next && <input type="hidden" name="next" value={next} />}

      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-[0.6875rem] font-semibold uppercase tracking-etiqueta text-mudo">Datos personales</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nombres" name="nombres" required defaultValue={perfil.nombres ?? ""} errors={state.errors?.nombres} />
          <Campo label="Apellidos" name="apellidos" required defaultValue={perfil.apellidos ?? ""} errors={state.errors?.apellidos} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo
            label="Fecha de nacimiento"
            name="fechaNacimiento"
            type="date"
            required
            defaultValue={perfil.fecha_nacimiento ?? ""}
            onChange={setNacimiento}
            errors={state.errors?.fechaNacimiento}
          />
          <Select
            label="Sexo"
            name="sexo"
            required
            defaultValue={perfil.sexo ?? ""}
            onChange={setSexo}
            opciones={[
              { valor: "masculino", etiqueta: "Masculino" },
              { valor: "femenino", etiqueta: "Femenino" },
              { valor: "otro", etiqueta: "Otro" },
            ]}
            errors={state.errors?.sexo}
          />
          <Campo
            label="Teléfono (con código de país)"
            name="telefono"
            type="tel"
            defaultValue={perfil.telefono ?? ""}
            errors={state.errors?.telefono}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Documento de identidad"
            name="documentoIdentidad"
            defaultValue={perfil.documento_identidad ?? ""}
            errors={state.errors?.documentoIdentidad}
          />
          <Campo
            label="Nacionalidad"
            name="nacionalidad"
            defaultValue={perfil.nacionalidad ?? ""}
            errors={state.errors?.nacionalidad}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5 rounded-md border border-azul/30 bg-azul/8 px-4 py-3">
          <span className="font-mono text-[0.625rem] font-semibold uppercase tracking-etiqueta text-azul-texto/70">
            Categoría calculada
          </span>
          <span className="font-mono text-sm font-semibold text-azul-texto">
            {categoriaCalculada}
          </span>
          <span className="font-mono text-[0.625rem] text-azul-texto/55">
            Se recalcula al cambiar tu fecha de nacimiento o tu sexo. No se edita a mano.
          </span>
        </div>

        <h2 className="font-mono text-[0.6875rem] font-semibold uppercase tracking-etiqueta text-mudo">Residencia</h2>
        <SelectorGeografico
          paises={paises}
          paisInicial={perfil.pais_id}
          departamentoInicial={perfil.departamento_id}
          ciudadInicial={perfil.ciudad_id}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-[0.6875rem] font-semibold uppercase tracking-etiqueta text-mudo">Datos de carrera y seguridad</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Talla de prenda"
            name="tallaPredeterminada"
            defaultValue={perfil.talla_predeterminada ?? ""}
            opciones={aOpciones(TALLAS)}
            errors={state.errors?.tallaPredeterminada}
          />
          <Select
            label="Tipo de sangre"
            name="tipoSangre"
            defaultValue={perfil.tipo_sangre ?? ""}
            opciones={aOpciones(TIPOS_SANGRE)}
            errors={state.errors?.tipoSangre}
          />
          <Select
            label="Nivel de experiencia"
            name="nivelExperiencia"
            defaultValue={perfil.nivel_experiencia ?? ""}
            opciones={NIVELES_EXPERIENCIA.map((n) => ({ valor: n.valor, etiqueta: n.etiqueta }))}
            errors={state.errors?.nivelExperiencia}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-[0.6875rem] font-semibold uppercase tracking-etiqueta text-mudo">Contacto de emergencia</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo
            label="Nombre"
            name="contactoEmergenciaNombre"
            required
            defaultValue={perfil.contacto_emergencia_nombre ?? ""}
            errors={state.errors?.contactoEmergenciaNombre}
          />
          <Campo
            label="Parentesco"
            name="contactoEmergenciaParentesco"
            defaultValue={perfil.contacto_emergencia_parentesco ?? ""}
            errors={state.errors?.contactoEmergenciaParentesco}
          />
          <Campo
            label="Teléfono"
            name="contactoEmergenciaTelefono"
            type="tel"
            required
            defaultValue={perfil.contacto_emergencia_telefono ?? ""}
            errors={state.errors?.contactoEmergenciaTelefono}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-[0.6875rem] font-semibold uppercase tracking-etiqueta text-mudo">Otros datos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            label="Ocupación"
            name="ocupacion"
            defaultValue={perfil.ocupacion ?? ""}
            errors={state.errors?.ocupacion}
          />
          <Select
            label="¿Cómo te enteraste de RunTicket?"
            name="comoSeEntero"
            defaultValue={perfil.como_se_entero ?? ""}
            opciones={aOpciones(ORIGENES)}
            errors={state.errors?.comoSeEntero}
          />
        </div>
      </section>

      {state.status === "error" && state.message && (
        <p className="rounded-lg px-3 py-2 text-sm bg-red-950 text-red-400">
          {state.message}
        </p>
      )}
      {state.status === "guardado" && (
        <p className="rounded-lg px-3 py-2 text-sm bg-emerald-950 text-emerald-400">
          Perfil guardado.
        </p>
      )}

      <Boton variante="primaria" type="submit" disabled={pending} className="self-start">
        {pending ? "Guardando…" : "Guardar perfil"}
      </Boton>
    </form>
  );
}
