"use client";

import { useActionState } from "react";
import { Campo } from "@/components/ui/Campo";
import { crearEmpresa, type CrearEmpresaState } from "./actions";
import { Boton } from "@/components/ui/Boton";

const initialState: CrearEmpresaState = { status: "idle" };

export function CrearEmpresaForm() {
  const [state, formAction, pending] = useActionState(crearEmpresa, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
      <h2 className="text-lg font-semibold text-texto">Nueva empresa organizadora</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nombre comercial" name="nombreComercial" required errors={state.errors?.nombreComercial} />
        <Campo
          label="Slug (URL: /organizadores/slug)"
          name="slug"
          required
          errors={state.errors?.slug}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo label="Correo de contacto" name="correoContacto" type="email" errors={state.errors?.correoContacto} />
        <Campo label="Teléfono de contacto" name="telefonoContacto" errors={state.errors?.telefonoContacto} />
        <Campo label="RTN" name="rtn" errors={state.errors?.rtn} />
      </div>

      {state.status === "error" && state.message && (
        <p className="rounded-lg px-3 py-2 text-sm bg-red-950 text-red-400">
          {state.message}
        </p>
      )}

      <Boton variante="primaria" type="submit" disabled={pending} className="self-start">
        {pending ? "Creando…" : "Crear empresa"}
      </Boton>
    </form>
  );
}
