"use client";

import { useActionState } from "react";
import { CampoContrasena } from "@/components/ui/CampoContrasena";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Aviso";
import { cambiarMiPassword, type PasswordState } from "./actions";

const initialState: PasswordState = { status: "idle" };

export function CambiarPasswordForm() {
  const [state, formAction, pending] = useActionState(cambiarMiPassword, initialState);

  return (
    <form action={formAction} className="flex max-w-120 flex-col gap-4">
      <CampoContrasena
        label="Nueva contraseña"
        name="password"
        required
        autoComplete="new-password"
        conMedidor
        errors={state.errors?.password}
      />
      <CampoContrasena
        label="Repite la nueva contraseña"
        name="confirmarPassword"
        required
        autoComplete="new-password"
        errors={state.errors?.confirmarPassword}
        ayuda="Mínimo 8 caracteres."
      />

      {state.status === "error" && state.message && <Aviso tono="rojo">{state.message}</Aviso>}
      {state.status === "guardado" && (
        <Aviso tono="verde">
          Contraseña actualizada. Tu sesión sigue abierta; la nueva contraseña se usa a partir del
          próximo inicio de sesión.
        </Aviso>
      )}

      <Boton variante="primaria" type="submit" disabled={pending} className="self-start">
        {pending ? "Guardando…" : "Cambiar contraseña"}
      </Boton>
    </form>
  );
}
