import { BotonEnlace } from "@/components/ui/Boton";

/**
 * Pantalla de 404 o de error.
 *
 * Vive en un componente compartido porque cada área la envuelve en su propio
 * `not-found.tsx` / `error.tsx`: así el mensaje aparece **dentro** del shell de
 * esa área y el usuario conserva el menú. Antes no había ninguno de estos
 * archivos en el proyecto, y las 26 llamadas a `notFound()` dejaban al usuario en
 * la pantalla genérica de Next, sin navegación y sin camino de vuelta.
 *
 * `accion` es un enlace de vuelta al lugar natural del área; `children` queda
 * para el botón de reintentar, que solo tienen las pantallas de error.
 */
export function PantallaEstado({
  codigo,
  titulo,
  descripcion,
  accion,
  children,
}: {
  codigo: string;
  titulo: string;
  descripcion: string;
  accion?: { href: string; texto: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <span className="font-mono text-[0.625rem] font-bold uppercase tracking-etiqueta text-mudo">
        {codigo}
      </span>
      <h1 className="display max-w-140 text-2xl text-texto">{titulo}</h1>
      <p className="max-w-140 text-sm leading-relaxed text-atenuado">{descripcion}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2.5">
        {children}
        {accion && (
          <BotonEnlace href={accion.href} variante="secundaria">
            {accion.texto}
          </BotonEnlace>
        )}
      </div>
    </div>
  );
}
