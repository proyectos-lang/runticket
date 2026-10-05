import { Aviso } from "./Aviso";

/**
 * El `?aviso=` con el que vuelven las acciones de servidor (ver
 * `redirigirConAviso`). Se pinta siempre en ámbar: es un «no se pudo» o un
 * «ten en cuenta», nunca un éxito, que ya se ve en la propia pantalla.
 */
export function AvisoDeRuta({ aviso }: { aviso?: string | string[] }) {
  const texto = Array.isArray(aviso) ? aviso[0] : aviso;
  if (!texto) return null;
  return (
    <Aviso tono="ambar" titulo="Atención">
      {texto}
    </Aviso>
  );
}
