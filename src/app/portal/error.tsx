"use client";

import { useEffect } from "react";
import { Boton } from "@/components/ui/Boton";
import { PantallaEstado } from "@/components/ui/PantallaEstado";

export default function ErrorPortal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error en el portal:", error);
  }, [error]);

  return (
    <PantallaEstado
      codigo="Error"
      titulo="No pudimos cargar tus datos"
      descripcion="Tu inscripción, tu dorsal y tu pago siguen guardados. Esto es un fallo al mostrarlos, no al registrarlos."
      accion={{ href: "/portal", texto: "Volver a mi perfil" }}
    >
      <Boton variante="secundaria" onClick={reset}>
        Reintentar
      </Boton>
    </PantallaEstado>
  );
}
