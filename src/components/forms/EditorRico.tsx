"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { EditorRicoProps } from "./EditorRicoInner";

// A nivel de módulo: dentro del componente, cada render de `useActionState`
// remontaría el editor y se perdería lo escrito.
const Editor = dynamic(() => import("./EditorRicoInner"), {
  ssr: false,
  loading: () => (
    <div className="h-52 w-full animate-pulse rounded-lg bg-superficie-2" />
  ),
});

/**
 * El campo oculto se renderiza **aquí**, no dentro del editor.
 *
 * El editor se carga en diferido (`ssr: false`), así que hasta que llegara su
 * código el formulario no tenía el campo `descripcion`. Quien guardaba antes de
 * ese momento —o con la red lenta— enviaba el campo ausente y la acción escribía
 * `null` encima de la descripción que ya existía. Con el campo fuera, el valor
 * guardado está presente desde el primer render y lo peor que puede ocurrir es
 * que no cambie nada.
 */
export function EditorRico({ name, defaultValue = "", ...resto }: EditorRicoProps) {
  const [html, setHtml] = useState(defaultValue);

  return (
    <>
      <input type="hidden" name={name} value={html} />
      <Editor defaultValue={defaultValue} onChange={setHtml} {...resto} />
    </>
  );
}
