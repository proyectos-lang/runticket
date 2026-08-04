"use client";

import { useEffect } from "react";
import { Boton } from "@/components/ui/Boton";
import { PantallaEstado } from "@/components/ui/PantallaEstado";

export default function ErrorGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // En producción el mensaje real no llega al cliente (Next solo manda el
  // `digest`), así que dejarlo en consola es la única forma de correlacionarlo
  // con el registro del servidor.
  useEffect(() => {
    console.error("Error no controlado:", error);
  }, [error]);

  return (
    <PantallaEstado
      codigo="Error"
      titulo="Algo se rompió por nuestra parte"
      descripcion="No es culpa tuya. Vuelve a intentarlo; si sigue fallando, avísanos indicando qué estabas haciendo."
      accion={{ href: "/", texto: "Ir al inicio" }}
    >
      <Boton variante="secundaria" onClick={reset}>
        Reintentar
      </Boton>
    </PantallaEstado>
  );
}
