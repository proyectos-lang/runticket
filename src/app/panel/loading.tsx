import { Esqueleto } from "@/components/ui/Esqueleto";

/**
 * Lo que se ve al pasar de una pantalla del panel a otra mientras llegan los
 * datos. Sin esto, la pantalla anterior se quedaba congelada hasta que el
 * servidor terminaba, y el clic parecía no haber hecho nada.
 */
export default function CargandoPanel() {
  return <Esqueleto />;
}
