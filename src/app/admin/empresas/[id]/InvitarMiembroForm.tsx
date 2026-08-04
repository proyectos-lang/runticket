"use client";

import { useActionState } from "react";
import { Campo } from "@/components/ui/Campo";
import { Select } from "@/components/ui/Select";
import { invitarMiembro, type InvitarState } from "./actions";
import { Boton } from "@/components/ui/Boton";

const initialState: InvitarState = { status: "idle" };

export function InvitarMiembroForm({ empresaId }: { empresaId: string }) {
  const [state, formAction, pending] = useActionState(
    invitarMiembro.bind(null, empresaId),
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Campo label="Correo" name="correo" type="email" required className="flex-1" />
      <Select
        label="Rol"
        name="rol"
        required
        placeholder="Selecciona…"
        opciones={[
          { valor: "admin_empresa", etiqueta: "Administrador" },
          { valor: "operador", etiqueta: "Operador" },
        ]}
      />
      <Boton variante="secundaria" type="submit" disabled={pending} className="whitespace-nowrap">
        {pending ? "Enviando…" : "Enviar invitación"}
      </Boton>

      {state.status === "error" && (
        <p className="text-sm sm:w-full text-red-400">{state.message}</p>
      )}
      {state.status === "invitado" && (
        <p className="text-sm sm:w-full text-emerald-400">
          Invitación enviada.
        </p>
      )}
    </form>
  );
}
