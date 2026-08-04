/**
 * La caja de contenido del producto. Sustituye a los ~53 sitios que repetían
 * `rounded-2xl border border-linea bg-superficie p-6`.
 */
export function Panel({
  children,
  titulo,
  descripcion,
  accion,
  /** `plano` quita el relleno: para paneles que contienen una tabla a sangre. */
  plano = false,
  className = "",
}: {
  children?: React.ReactNode;
  titulo?: React.ReactNode;
  descripcion?: React.ReactNode;
  /** Acción alineada a la derecha del título. */
  accion?: React.ReactNode;
  plano?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-linea bg-superficie ${className}`}
    >
      {(titulo || accion) && (
        <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
          <div className="flex flex-col gap-1">
            {titulo && (
              <h2 className="text-base font-semibold tracking-display text-texto">{titulo}</h2>
            )}
            {descripcion && <p className="text-sm text-atenuado">{descripcion}</p>}
          </div>
          {accion}
        </header>
      )}
      {children && <div className={plano ? "" : "px-6 pb-6"}>{children}</div>}
    </section>
  );
}

/** Título de grupo sobre una rejilla de paneles. */
export function TituloSeccion({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-etiqueta text-mudo">{children}</h2>
  );
}
