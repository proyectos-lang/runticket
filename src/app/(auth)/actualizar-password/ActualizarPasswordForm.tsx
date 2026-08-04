"use client";

import { useActionState } from "react";
import { Campo } from "@/components/ui/Campo";
import { actualizarPassword, type ActualizarPasswordState } from "./actions";
import { Boton } from "@/components/ui/Boton";

const initialState: ActualizarPasswordState = { status: "idle" };

export function ActualizarPasswordForm() {
  const [state, formAction, pending] = useActionState(actualizarPassword, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Campo label="Nueva contraseña" name="password" type="password" required errors={state.errors?.password} />
      <Campo
        label="Confirma la nueva contraseña"
        name="confirmarPassword"
        type="password"
        required
        errors={state.errors?.confirmarPassword}
      />

      {state.status === "error" && state.message && !state.errors && (
        <p className="rounded-lg px-3 py-2 text-sm bg-red-950 text-red-400">
          {state.message}
        </p>
      )}

      <Boton variante="primaria" type="submit" disabled={pending} className="mt-2">
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Boton>
    </form>
  );
}
