"use client";

import { useState } from "react";
import { AyudaError, CLASE_CAMPO, Etiqueta } from "./Campo";
import { MedidorFuerza } from "./MedidorFuerza";

/**
 * Campo de contraseña con el enlace «Ver» dentro de la caja y, si se pide, el
 * medidor de fuerza debajo.
 *
 * El botón de mostrar es un `<button>` real y no un icono decorativo: sin él,
 * quien escribe en un teclado táctil no tiene forma de comprobar lo que tecleó
 * y abandona el registro.
 */
export function CampoContrasena({
  label,
  name,
  required = false,
  errors,
  ayuda,
  conMedidor = false,
  autoComplete = "current-password",
}: {
  label: string;
  name: string;
  required?: boolean;
  errors?: string[];
  ayuda?: string;
  conMedidor?: boolean;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [valor, setValor] = useState("");

  return (
    <div className="flex flex-col gap-1.5">
      <Etiqueta htmlFor={name} required={required}>
        {label}
      </Etiqueta>

      <div className="relative">
        <input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          autoComplete={autoComplete}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className={`${CLASE_CAMPO} pr-14`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-texto/45 transition-colors hover:text-texto"
        >
          {visible ? "Ocultar" : "Ver"}
        </button>
      </div>

      {conMedidor ? <MedidorFuerza valor={valor} /> : <AyudaError ayuda={ayuda} errors={errors} />}
      {conMedidor && errors?.[0] && <p className="text-sm text-rojo">{errors[0]}</p>}
    </div>
  );
}
