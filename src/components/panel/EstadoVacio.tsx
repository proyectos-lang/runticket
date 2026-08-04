import { Icono, type NombreIcono } from "@/components/shell/iconos";
import { BotonEnlace } from "@/components/ui/Boton";

/**
 * Lo que ve un módulo cuando todavía no hay datos. Existe para que el panel se
 * entienda desde el primer día: sin esto, una empresa recién creada veía
 * pantallas en blanco y parecía que faltaban funcionalidades.
 */
export function EstadoVacio({
  icono,
  titulo,
  descripcion,
  accion,
}: {
  icono: NombreIcono;
  titulo: string;
  descripcion: string;
  accion?: { href: string; texto: string };
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-linea-fuerte px-6 py-14 text-center">
      <span className="rounded-2xl bg-superficie-2 p-3 text-mudo">
        <Icono nombre={icono} className="size-6" />
      </span>
      <h3 className="text-base font-semibold tracking-display text-texto">{titulo}</h3>
      <p className="max-w-md text-sm text-atenuado">{descripcion}</p>
      {/* La acción de un estado vacío es LA acción de la pantalla —no hay nada
          más que hacer en ella—, así que aquí el naranja está justificado. */}
      {accion && (
        <BotonEnlace href={accion.href} variante="primaria" className="mt-2">
          {accion.texto}
        </BotonEnlace>
      )}
    </div>
  );
}

/** Cabecera común de los módulos de primer nivel. */
export function CabeceraModulo({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-display text-texto">{titulo}</h1>
        <p className="max-w-2xl text-sm text-atenuado">{descripcion}</p>
      </div>
      {children}
    </div>
  );
}
