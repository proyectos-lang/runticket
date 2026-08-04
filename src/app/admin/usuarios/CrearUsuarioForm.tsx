"use client";

import { useActionState, useState } from "react";
import { Campo } from "@/components/ui/Campo";
import { CampoContrasena } from "@/components/ui/CampoContrasena";
import { Select } from "@/components/ui/Select";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Aviso";
import { crearUsuario, type CrearUsuarioState } from "./actions";

const initialState: CrearUsuarioState = { status: "idle" };

export type EmpresaOpcion = { id: string; nombre: string };

/**
 * Alta manual de una cuenta.
 *
 * Va plegado porque la pantalla es, ante todo, un listado para consultar: un
 * formulario de seis campos siempre abierto empujaría la tabla fuera de la vista
 * en la tarea que se hace a diario.
 */
export function CrearUsuarioForm({ empresas }: { empresas: EmpresaOpcion[] }) {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction, pending] = useActionState(crearUsuario, initialState);
  const [empresaId, setEmpresaId] = useState("");

  if (!abierto) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Boton variante="primaria" onClick={() => setAbierto(true)}>
          Crear usuario
        </Boton>
        {state.status === "creado" && (
          <span className="text-sm text-verde">Cuenta creada.</span>
        )}
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border p-5 border-linea bg-superficie"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nombres" name="nombres" required errors={state.errors?.nombres} />
        <Campo label="Apellidos" name="apellidos" required errors={state.errors?.apellidos} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Correo" name="correo" type="email" required errors={state.errors?.correo} />
        <CampoContrasena
          label="Contraseña"
          name="password"
          required
          autoComplete="new-password"
          conMedidor
          errors={state.errors?.password}
        />
      </div>

      <Select
        label="Rol de plataforma"
        name="rolPlataforma"
        required
        defaultValue="usuario"
        opciones={[
          { valor: "usuario", etiqueta: "Usuario (corredor u organizador)" },
          { valor: "super_admin", etiqueta: "Super-administrador de la plataforma" },
        ]}
        ayuda="El super-administrador ve y gobierna todas las empresas."
        errors={state.errors?.rolPlataforma}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Empresa"
          name="empresaId"
          opciones={empresas.map((e) => ({ valor: e.id, etiqueta: e.nombre }))}
          placeholder={empresas.length ? "Sin empresa (solo corredor)" : "No hay empresas todavía"}
          onChange={setEmpresaId}
          ayuda="Opcional. Sin empresa, la cuenta solo puede inscribirse en carreras."
          errors={state.errors?.empresaId}
        />
        <Select
          label="Rol en la empresa"
          name="rolEmpresa"
          // Solo se pide cuando hay empresa: sin ella el campo no significa nada.
          required={!!empresaId}
          opciones={[
            { valor: "admin_empresa", etiqueta: "Administrador" },
            { valor: "operador", etiqueta: "Operador (día de carrera)" },
          ]}
          placeholder={empresaId ? "Selecciona…" : "—"}
          ayuda={empresaId ? "El operador no ve dinero ni cupones." : "Elige antes una empresa."}
          errors={state.errors?.rolEmpresa}
        />
      </div>

      {state.status === "error" && state.message && <Aviso tono="rojo">{state.message}</Aviso>}
      {state.status === "creado" && (
        <Aviso tono="verde">
          Cuenta creada y lista para entrar. No se envía ningún correo: comunícale tú la
          contraseña.
        </Aviso>
      )}

      <div className="flex flex-wrap gap-2">
        <Boton variante="primaria" type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear usuario"}
        </Boton>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-full border px-5 py-2.5 text-sm font-medium border-linea-fuerte text-atenuado hover:bg-superficie-2"
        >
          {state.status === "creado" ? "Cerrar" : "Cancelar"}
        </button>
      </div>
    </form>
  );
}
