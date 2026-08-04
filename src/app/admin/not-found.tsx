import { PantallaEstado } from "@/components/ui/PantallaEstado";

export default function NoEncontradoAdmin() {
  return (
    <PantallaEstado
      codigo="Error 404"
      titulo="No encontramos este registro"
      descripcion="La empresa o la persona que buscas ya no existe, o el identificador del enlace no es válido."
      accion={{ href: "/admin/empresas", texto: "Ver empresas" }}
    />
  );
}
