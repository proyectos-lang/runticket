import { PantallaEstado } from "@/components/ui/PantallaEstado";

/**
 * Se renderiza dentro de `panel/layout.tsx`, así que el organizador conserva el
 * menú lateral. La mayoría de las llamadas a `notFound()` del panel vienen de
 * pedir una carrera que no es de la empresa activa, de ahí el texto.
 */
export default function NoEncontradoPanel() {
  return (
    <PantallaEstado
      codigo="Error 404"
      titulo="No encontramos esta carrera"
      descripcion="O no existe, o pertenece a otra empresa. Si trabajas con varias, comprueba cuál tienes seleccionada arriba."
      accion={{ href: "/panel/eventos", texto: "Ver mis carreras" }}
    />
  );
}
