"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Campo } from "@/components/ui/Campo";
import { CampoContrasena } from "@/components/ui/CampoContrasena";
import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { iniciarSesion, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(iniciarSesion, initialState);

  // El límite de intentos no se resuelve reintentando, así que además del aviso
  // se bloquea el botón: dejarlo activo invita a seguir golpeando la puerta.
  const bloqueado = state.status === "error" && /intentos/i.test(state.message ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}

      {state.status === "error" && state.message && <Aviso tono="rojo">{state.message}</Aviso>}

      <Campo
        label="Correo electrónico"
        name="correo"
        type="email"
        required
        defaultValue={state.correo}
        errors={state.errors?.correo}
      />
      <CampoContrasena label="Contraseña" name="password" required errors={state.errors?.password} />

      <Boton variante="primaria" type="submit" disabled={pending || bloqueado} ancho className="mt-2">
        {pending ? "Entrando…" : "Entrar"}
      </Boton>

      <div className="flex flex-col items-center gap-2 text-sm text-atenuado">
        <p>
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-semibold text-cian hover:underline">
            Crear cuenta
          </Link>
        </p>
        <Link href="/recuperar-password" className="text-cian hover:underline">
          Recuperar contraseña
        </Link>
      </div>
    </form>
  );
}
