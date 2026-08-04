import { PantallaEstado } from "@/components/ui/PantallaEstado";

export default function NoEncontradoPortal() {
  return (
    <PantallaEstado
      codigo="Error 404"
      titulo="No encontramos esta inscripción"
      descripcion="Puede que se anulara, que la transfirieras a otra persona o que el enlace no sea tuyo."
      accion={{ href: "/portal/inscripciones", texto: "Ver mis inscripciones" }}
    />
  );
}
