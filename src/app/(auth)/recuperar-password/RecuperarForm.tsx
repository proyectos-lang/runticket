"use client";

import { useActionState } from "react";
import { Campo } from "@/components/ui/Campo";
import { solicitarRecuperacion, type RecuperarState } from "./actions";
import { Boton } from "@/components/ui/Boton";

const initialState: RecuperarState = { status: "idle" };

export function RecuperarForm() {
  const [state, formAction, pending] = useActionState(solicitarRecuperacion, initialState);

  if (state.status === "enviado") {
    return (
      <p className="rounded-lg px-4 py-3 text-sm bg-emerald-950 text-emerald-400">
        Si el correo existe en RunTicket, te enviamos un enlace para restablecer tu contraseña.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Campo label="Correo electrónico" name="correo" type="email" required errors={state.errors?.correo} />
      <Boton variante="primaria" type="submit" disabled={pending} className="mt-2">
        {pending ? "Enviando…" : "Enviar enlace de recuperación"}
      </Boton>
    </form>
  );
}
