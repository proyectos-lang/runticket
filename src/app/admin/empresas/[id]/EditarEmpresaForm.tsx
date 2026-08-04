"use client";

import { useActionState } from "react";
import { Campo } from "@/components/ui/Campo";
import { actualizarEmpresa, type EmpresaState } from "./actions";
import { Boton } from "@/components/ui/Boton";

const initialState: EmpresaState = { status: "idle" };

export function EditarEmpresaForm({
  empresaId,
  empresa,
}: {
  empresaId: string;
  empresa: {
    nombre_comercial: string;
    slug: string;
    correo_contacto: string | null;
    telefono_contacto: string | null;
    rtn: string | null;
    colores_marca: Record<string, unknown>;
  };
}) {
  const [state, formAction, pending] = useActionState(
    actualizarEmpresa.bind(null, empresaId),
    initialState
  );

  const colores = empresa.colores_marca as { primario?: string; secundario?: string };

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Nombre comercial"
          name="nombreComercial"
          required
          defaultValue={empresa.nombre_comercial}
          errors={state.errors?.nombreComercial}
        />
        <Campo
          label="Identificador de URL"
          name="slug"
          required
          defaultValue={empresa.slug}
          ayuda={`Su página pública es /organizadores/${empresa.slug}`}
          errors={state.errors?.slug}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo
          label="Correo de contacto"
          name="correoContacto"
          type="email"
          defaultValue={empresa.correo_contacto ?? ""}
          errors={state.errors?.correoContacto}
        />
        <Campo
          label="Teléfono"
          name="telefonoContacto"
          type="tel"
          defaultValue={empresa.telefono_contacto ?? ""}
          ayuda="Con código de país: se usa para el pago por WhatsApp"
          errors={state.errors?.telefonoContacto}
        />
        <Campo label="RTN" name="rtn" defaultValue={empresa.rtn ?? ""} errors={state.errors?.rtn} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Color primario"
          name="colorPrimario"
          type="color"
          defaultValue={colores.primario ?? "#10b981"}
          errors={state.errors?.colorPrimario}
        />
        <Campo
          label="Color secundario"
          name="colorSecundario"
          type="color"
          defaultValue={colores.secundario ?? "#0ea5e9"}
          errors={state.errors?.colorSecundario}
        />
      </div>

      {state.status === "error" && state.message && (
        <p className="rounded-lg px-3 py-2 text-sm bg-red-950 text-red-400">
          {state.message}
        </p>
      )}
      {state.status === "guardado" && (
        <p className="rounded-lg px-3 py-2 text-sm bg-emerald-950 text-emerald-400">
          Datos guardados.
        </p>
      )}

      <Boton variante="primaria" type="submit" disabled={pending} className="self-start">
        {pending ? "Guardando…" : "Guardar cambios"}
      </Boton>
    </form>
  );
}
