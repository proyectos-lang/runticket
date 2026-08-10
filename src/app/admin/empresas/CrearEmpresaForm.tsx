"use client";

import { useActionState, useState } from "react";
import { Campo } from "@/components/ui/Campo";
import { generarSlug } from "@/lib/slug";
import { crearEmpresa, type CrearEmpresaState } from "./actions";
import { Boton } from "@/components/ui/Boton";

const initialState: CrearEmpresaState = { status: "idle" };

/**
 * Alta de empresa organizadora.
 *
 * **Ya no se pide el identificador de URL.** Lo deriva el servidor del nombre
 * comercial. Dar de alta a un cliente no es el momento de inventar una
 * dirección: se escribía con tildes, con mayúsculas o con espacios, rebotaba con
 * un error de formato, y era un campo más entre el super-administrador y la
 * empresa creada.
 *
 * En su lugar se enseña **la dirección que va a quedar**, en vivo mientras se
 * teclea el nombre. Se calcula con el mismo `generarSlug` que usa el servidor,
 * así que lo que se ve es lo que se guarda; lo único que puede cambiar es que se
 * le añada un número si esa dirección ya está cogida, y eso lo dice el texto de
 * apoyo en vez de callarlo.
 */
export function CrearEmpresaForm() {
  const [state, formAction, pending] = useActionState(crearEmpresa, initialState);
  const [nombre, setNombre] = useState("");

  const slug = generarSlug(nombre);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border p-6 border-linea bg-superficie">
      <h2 className="text-lg font-semibold text-texto">Nueva empresa organizadora</h2>
      <Campo
        label="Nombre comercial"
        name="nombreComercial"
        required
        placeholder="Carreras del Valle"
        onChange={setNombre}
        ayuda={
          slug
            ? `Su página pública será /organizadores/${slug} — si ya está en uso, se le añade un número.`
            : "De aquí sale su dirección pública, que después podrás cambiar en su ficha."
        }
        errors={state.errors?.nombreComercial}
      />
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
