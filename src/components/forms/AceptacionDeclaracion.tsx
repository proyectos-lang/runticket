"use client";

import { useState } from "react";
import { EtiquetaMono } from "@/components/ui/Datos";

/**
 * La aceptación de la declaración de salud, en lugar de una firma dibujada.
 *
 * Un trazo hecho con el dedo no prueba nada: no se coteja con ninguna firma
 * registrada, cualquiera puede garabatearlo y de hecho durante un tiempo se
 * estuvo guardando en blanco sin que nadie lo notara. Lo que sí constituye
 * prueba es el acto de aceptar y su rastro: **quién, qué versión del documento,
 * cuándo, desde qué IP y con qué dispositivo**, y todo eso ya se guarda en
 * `inscripcion_firmas`.
 *
 * Por eso este bloque no es una casilla pequeña al pie: es el acto central del
 * paso, con el área de pulsación de una tarjeta y con la constancia escrita a la
 * vista, para que quien acepta sepa exactamente qué queda registrado.
 */
export function AceptacionDeclaracion({
  name = "acepto",
  version,
  nombre,
  enNombreDeOtro = false,
  error,
  alCambiar,
}: {
  name?: string;
  /** Versión del documento que se está aceptando; queda en el expediente. */
  version: number;
  /** Quién acepta, para que el texto no hable de un «usuario» abstracto. */
  nombre?: string;
  /** En el panel: lo marca el organizador por la persona que tiene delante. */
  enNombreDeOtro?: boolean;
  error?: string;
  alCambiar?: (aceptado: boolean) => void;
}) {
  const [aceptado, setAceptado] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <label
        className={`flex cursor-pointer items-start gap-3.5 rounded-xl border px-5 py-4.5 transition-colors ${
          aceptado
            ? "border-naranja/45 bg-naranja/6"
            : "border-linea-fuerte bg-superficie hover:border-texto/25"
        }`}
      >
        <input
          type="checkbox"
          name={name}
          value="on"
          checked={aceptado}
          onChange={(e) => {
            setAceptado(e.target.checked);
            alCambiar?.(e.target.checked);
          }}
          className="mt-0.5 size-5 shrink-0 rounded accent-[var(--color-naranja)]"
        />
        <span className="flex flex-col gap-1.5">
          <span className="font-semibold text-texto">
            {enNombreDeOtro
              ? `${nombre || "La persona"} leyó y acepta la declaración`
              : "He leído y acepto la declaración"}
          </span>
          <span className="text-[0.78125rem] leading-relaxed text-atenuado">
            {enNombreDeOtro
              ? "Confirmas que le mostraste el texto completo y que aceptó participar bajo su propia responsabilidad."
              : "Aceptas la declaración de salud y el deslinde de responsabilidad, y participas bajo tu propia responsabilidad."}
          </span>
        </span>
      </label>

      {/* La constancia se enseña antes de aceptar, no después: es la única
          prueba que queda y quien acepta tiene derecho a saber qué se guarda. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
        <EtiquetaMono>Queda registrado</EtiquetaMono>
        <span className="font-mono text-[0.65625rem] text-texto/45">
          {[nombre, `versión ${version} del documento`, "fecha y hora", "IP", "dispositivo"]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
