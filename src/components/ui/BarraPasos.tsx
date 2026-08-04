/**
 * Indicador de progreso del alta en 3 pasos.
 *
 * El paso actual va en naranja porque es la urgencia de la pantalla, no una
 * acción: no cuenta para la regla del botón primario único.
 */
export function BarraPasos({
  pasos,
  actual,
  className = "",
}: {
  pasos: string[];
  /** Índice base 0 del paso en curso. */
  actual: number;
  className?: string;
}) {
  return (
    <ol className={`flex items-center gap-2 ${className}`}>
      {pasos.map((paso, i) => {
        const hecho = i < actual;
        const activo = i === actual;
        return (
          <li key={paso} className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span
                className={`h-0.5 rounded-full transition-colors ${
                  hecho ? "bg-naranja/45" : activo ? "bg-naranja" : "bg-linea-fuerte"
                }`}
              />
              <span
                className={`truncate text-xs font-medium uppercase tracking-etiqueta ${
                  activo ? "text-naranja-suave" : hecho ? "text-atenuado" : "text-mudo"
                }`}
              >
                <span className="font-mono">{i + 1}</span> · {paso}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
