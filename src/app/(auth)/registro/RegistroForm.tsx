"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Campo } from "@/components/ui/Campo";
import { CampoContrasena } from "@/components/ui/CampoContrasena";
import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { registrarCuenta, type RegistroState } from "./actions";

const initialState: RegistroState = { status: "idle" };

export function RegistroForm() {
  const [state, formAction, pending] = useActionState(registrarCuenta, initialState);

  if (state.status === "revisa-correo") {
    return (
      <Aviso tono="cian" titulo="Revisa tu correo">
        Te enviamos un enlace para confirmar tu cuenta. Si no aparece en unos minutos, mira en la
        carpeta de correo no deseado.
      </Aviso>
    );
  }

  // Un correo ya registrado no es un error del formulario: es una invitación a
  // entrar, y el aviso lleva el enlace directo.
  const yaRegistrado = state.status === "error" && /registrad/i.test(state.message ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.status === "error" && state.message && (
        <Aviso
          tono="rojo"
          accion={
            yaRegistrado ? (
              <Link href="/login" className="text-sm font-semibold text-rojo underline">
                Entrar
              </Link>
            ) : undefined
          }
        >
          {state.message}
        </Aviso>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Nombres" name="nombres" required errors={state.errors?.nombres} />
        <Campo label="Apellidos" name="apellidos" required errors={state.errors?.apellidos} />
      </div>
      <Campo
        label="Correo electrónico"
        name="correo"
        type="email"
        required
        errors={state.errors?.correo}
      />
      <CampoContrasena
        label="Contraseña"
        name="password"
        required
        conMedidor
        autoComplete="new-password"
        errors={state.errors?.password}
      />

      <Boton variante="primaria" type="submit" disabled={pending} ancho className="mt-2">
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </Boton>

      <p className="font-mono text-[0.6875rem] leading-relaxed text-texto/35">
        Al crear tu cuenta aceptas los términos de uso y la política de privacidad de RunTicket.
      </p>

      <p className="text-center text-sm text-atenuado">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-cian hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
