import { TarjetaMetrica } from "@/components/ui/Datos";

/** Cifra destacada: cuando el dato es un solo número, no lleva gráfico. */
export { TarjetaMetrica as Tarjeta };

/**
 * Medidor de ocupación: una razón contra un límite se lee mejor como barra de
 * progreso que como gráfico, porque el límite es parte del dato.
 */
export function Medidor({
  etiqueta,
  actual,
  maximo,
}: {
  etiqueta: string;
  actual: number;
  maximo: number | null;
}) {
  const porcentaje = maximo && maximo > 0 ? Math.min(100, Math.round((actual / maximo) * 100)) : null;

  return (
    <div className="viz flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-texto">{etiqueta}</span>
        <span className="tabular-nums text-atenuado">
          {actual}
          {maximo ? ` / ${maximo}` : ""}
          {porcentaje !== null && <span className="ml-2 text-mudo">{porcentaje}%</span>}
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--viz-track)" }}
        role="meter"
        aria-valuenow={actual}
        aria-valuemax={maximo ?? undefined}
        aria-label={`Ocupación de ${etiqueta}`}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${porcentaje ?? 100}%`, background: "var(--viz-serie)" }}
        />
      </div>
      {maximo === null && <p className="text-xs text-mudo">Cupo abierto</p>}
    </div>
  );
}

/** Tabla equivalente a un gráfico: la vía accesible cuando el color no basta. */
export function TablaDatos({
  titulo,
  datos,
  columna = "Corredores",
}: {
  titulo: string;
  datos: { etiqueta: string; valor: number }[];
  columna?: string;
}) {
  const total = datos.reduce((a, d) => a + d.valor, 0);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-xs text-mudo hover:text-texto">
        Ver {titulo.toLowerCase()} como tabla
      </summary>
      <table className="mt-2 w-full text-left">
        <thead className="font-mono text-[0.6875rem] uppercase tracking-etiqueta text-mudo">
          <tr>
            <th className="py-1">Grupo</th>
            <th className="py-1 text-right">{columna}</th>
            <th className="py-1 text-right">%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-linea">
          {datos.map((d) => (
            <tr key={d.etiqueta}>
              <td className="py-1 text-atenuado">{d.etiqueta}</td>
              <td className="py-1 text-right tabular-nums text-texto">{d.valor}</td>
              <td className="py-1 text-right tabular-nums text-mudo">
                {total ? Math.round((d.valor / total) * 100) : 0}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
