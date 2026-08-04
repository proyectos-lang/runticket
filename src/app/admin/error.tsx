"use client";

import { useEffect } from "react";
import { Boton } from "@/components/ui/Boton";
import { PantallaEstado } from "@/components/ui/PantallaEstado";

export default function ErrorAdmin({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error en la consola de plataforma:", error);
  }, [error]);

  return (
    <PantallaEstado
      codigo="Error"
      titulo="No pudimos cargar esta pantalla"
      descripcion="Reintenta. Si persiste, revisa el registro del servidor: esta consola opera sobre todas las empresas y conviene no dar nada por supuesto."
      accion={{ href: "/admin", texto: "Volver a la consola" }}
    >
      <Boton variante="secundaria" onClick={reset}>
        Reintentar
      </Boton>
    </PantallaEstado>
  );
}
