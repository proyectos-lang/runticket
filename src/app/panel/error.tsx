"use client";

import { useEffect } from "react";
import { Boton } from "@/components/ui/Boton";
import { PantallaEstado } from "@/components/ui/PantallaEstado";

export default function ErrorPanel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error en el panel:", error);
  }, [error]);

  return (
    <PantallaEstado
      codigo="Error"
      titulo="No pudimos cargar esta pantalla"
      descripcion="Las guardas de permisos y las consultas del panel pueden fallar si tu sesión caducó o si cambiaste de empresa en otra pestaña. Reintenta antes de dar nada por perdido."
      accion={{ href: "/panel", texto: "Volver al panel" }}
    >
      <Boton variante="secundaria" onClick={reset}>
        Reintentar
      </Boton>
    </PantallaEstado>
  );
}
