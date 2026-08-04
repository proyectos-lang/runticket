import { PantallaEstado } from "@/components/ui/PantallaEstado";

export default function NoEncontrado() {
  return (
    <PantallaEstado
      codigo="Error 404"
      titulo="Esta página no existe"
      descripcion="Puede que la carrera se haya retirado, que el enlace esté mal copiado o que haya cambiado de dirección."
      accion={{ href: "/eventos", texto: "Ver todas las carreras" }}
    />
  );
}
