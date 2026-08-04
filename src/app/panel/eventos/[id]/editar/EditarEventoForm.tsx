"use client";

import { useActionState } from "react";
import { Campo } from "@/components/ui/Campo";
import { AreaTexto } from "@/components/ui/AreaTexto";
import { EditorRico } from "@/components/forms/EditorRico";
import { Select } from "@/components/ui/Select";
import { DISCIPLINAS, DISCIPLINA_LABEL } from "@/lib/disciplinas";
import { actualizarEvento, type EventoState } from "../actions";
import { Boton } from "@/components/ui/Boton";

const initialState: EventoState = { status: "idle" };

const ZONAS = [
  { valor: "America/Tegucigalpa", etiqueta: "Honduras (UTC−6)" },
  { valor: "America/Guatemala", etiqueta: "Guatemala (UTC−6)" },
  { valor: "America/El_Salvador", etiqueta: "El Salvador (UTC−6)" },
  { valor: "America/Managua", etiqueta: "Nicaragua (UTC−6)" },
  { valor: "America/Costa_Rica", etiqueta: "Costa Rica (UTC−6)" },
  { valor: "America/Panama", etiqueta: "Panamá (UTC−5)" },
  { valor: "America/Mexico_City", etiqueta: "México (UTC−6)" },
];

const MONEDAS = [
  { valor: "HNL", etiqueta: "HNL — Lempira" },
  { valor: "USD", etiqueta: "USD — Dólar" },
  { valor: "GTQ", etiqueta: "GTQ — Quetzal" },
  { valor: "CRC", etiqueta: "CRC — Colón" },
  { valor: "MXN", etiqueta: "MXN — Peso mexicano" },
];

const OPCIONES_DISCIPLINA = DISCIPLINAS.map((d) => ({
  valor: d,
  etiqueta: DISCIPLINA_LABEL[d],
}));

export function EditarEventoForm({
  eventoId,
  evento,
  departamentos,
  hayInscripciones,
}: {
  eventoId: string;
  evento: {
    nombre: string;
    slug: string;
    descripcion: string | null;
    fechaInicioLocal: string;
    fechaLimiteLocal: string;
    direccion: string | null;
    moneda: string;
    zonaHoraria: string;
    estado: string;
    disciplina: string;
    departamentoId: string | null;
    kitContenido: string[];
  };
  departamentos: { id: string; nombre: string }[];
  hayInscripciones: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    actualizarEvento.bind(null, eventoId),
    initialState
  );

  const slugBloqueado = evento.estado !== "borrador";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Campo
        label="Nombre del evento"
        name="nombre"
        required
        defaultValue={evento.nombre}
        errors={state.errors?.nombre}
      />

      <Campo
        label="Identificador de URL"
        name="slug"
        required={!slugBloqueado}
        disabled={slugBloqueado}
        defaultValue={evento.slug}
        ayuda={
          slugBloqueado
            ? "No se puede cambiar: rompería los enlaces ya compartidos, los recordatorios de calendario que la gente ya guardó y las notificaciones enviadas."
            : "Solo editable mientras el evento está en borrador."
        }
        errors={state.errors?.slug}
      />

      <EditorRico
        name="descripcion"
        label="Descripción"
        defaultValue={evento.descripcion ?? ""}
        ayuda="Es lo que leen los corredores en la página del evento: el recorrido, qué incluye la inscripción, avituallamientos, dónde aparcar."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Fecha y hora de inicio"
          name="fechaInicio"
          type="datetime-local"
          required
          defaultValue={evento.fechaInicioLocal}
          ayuda="En la zona horaria del evento."
          errors={state.errors?.fechaInicio}
        />
        <Campo
          label="Cierre de inscripciones"
          name="fechaLimiteInscripcion"
          type="datetime-local"
          defaultValue={evento.fechaLimiteLocal}
          ayuda="Opcional. Si se deja vacío, se admiten inscripciones hasta el evento."
          errors={state.errors?.fechaLimiteInscripcion}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Disciplina"
          name="disciplina"
          required
          defaultValue={evento.disciplina}
          opciones={OPCIONES_DISCIPLINA}
          placeholder="Selecciona la disciplina…"
          ayuda="Es el filtro principal del listado público y el distintivo de la tarjeta."
          errors={state.errors?.disciplina}
        />
        <Select
          label="Departamento"
          name="departamentoId"
          defaultValue={evento.departamentoId ?? ""}
          opciones={departamentos.map((d) => ({ valor: d.id, etiqueta: d.nombre }))}
          placeholder="Sin especificar"
          ayuda="Permite que la carrera aparezca al filtrar por zona del país."
          errors={state.errors?.departamentoId}
        />
      </div>

      <Campo
        label="Dirección"
        name="direccion"
        defaultValue={evento.direccion ?? ""}
        ayuda="Las coordenadas del mapa se fijan en la sección Ubicación y ruta."
        errors={state.errors?.direccion}
      />

      <AreaTexto
        label="Contenido del kit"
        name="kitContenido"
        rows={5}
        defaultValue={evento.kitContenido.join("\n")}
        placeholder={"Camiseta técnica\nMedalla de finalista\nChip de cronometraje\nAvituallamiento"}
        ayuda="Un artículo por línea. Se muestra en la ficha pública y en la pantalla de retiro de kit del corredor."
        errors={state.errors?.kitContenido}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Zona horaria"
          name="zonaHoraria"
          required
          defaultValue={evento.zonaHoraria}
          opciones={ZONAS}
          errors={state.errors?.zonaHoraria}
        />
        {hayInscripciones ? (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-atenuado">Moneda</span>
            <p className="rounded-lg px-3 py-2 text-sm bg-superficie-2 text-atenuado">
              {evento.moneda}
            </p>
            <p className="text-xs text-atenuado">
              No se puede cambiar: ya hay cobros registrados en esta moneda.
            </p>
            <input type="hidden" name="moneda" value={evento.moneda} />
          </div>
        ) : (
          <Select
            label="Moneda"
            name="moneda"
            required
            defaultValue={evento.moneda}
            opciones={MONEDAS}
            errors={state.errors?.moneda}
          />
        )}
      </div>

      {state.status === "error" && state.message && (
        <p className="rounded-lg px-3 py-2 text-sm bg-red-950 text-red-400">
          {state.message}
        </p>
      )}
      {state.status === "guardado" && (
        <p className="rounded-lg px-3 py-2 text-sm bg-emerald-950 text-emerald-400">
          Cambios guardados.
        </p>
      )}

      <Boton variante="primaria" type="submit" disabled={pending} className="self-start">
        {pending ? "Guardando…" : "Guardar cambios"}
      </Boton>
    </form>
  );
}
