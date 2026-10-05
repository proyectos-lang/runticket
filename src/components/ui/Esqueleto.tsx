/**
 * Armazón genérico de una pantalla cargando: un título, una línea y tres
 * bloques. No imita ninguna pantalla concreta —no hace falta: lo que importa
 * es que el clic responda al instante y el ojo sepa que algo viene—.
 *
 * `aria-busy` y el texto oculto son para quien usa lector de pantalla.
 */
export function Esqueleto() {
  return (
    <div aria-busy="true" className="flex animate-pulse flex-col gap-6">
      <span className="sr-only">Cargando…</span>
      <div className="flex flex-col gap-2">
        <div className="h-7 w-56 rounded-md bg-superficie-2" />
        <div className="h-4 w-80 max-w-full rounded-md bg-superficie-2/70" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-24 rounded-2xl bg-superficie-2" />
        <div className="h-24 rounded-2xl bg-superficie-2" />
        <div className="h-24 rounded-2xl bg-superficie-2" />
      </div>
      <div className="h-64 rounded-2xl bg-superficie-2/70" />
    </div>
  );
}
