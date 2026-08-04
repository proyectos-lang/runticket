"use client";

/**
 * Fila seleccionable de un grupo de radios: la usa el selector de categoría de
 * la inscripción y el de método de pago.
 *
 * La fila entera es la etiqueta, no solo el círculo: en móvil acertar un radio
 * de 16px es la diferencia entre inscribirse y abandonar.
 */
export function RadioFila({
  name,
  value,
  checked,
  onChange,
  disabled = false,
  titulo,
  detalle,
  derecha,
  className = "",
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  disabled?: boolean;
  titulo: React.ReactNode;
  detalle?: React.ReactNode;
  /** Bloque alineado a la derecha: normalmente el precio. */
  derecha?: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-colors ${
        disabled
          ? "cursor-not-allowed border-linea opacity-55"
          : checked
            ? "cursor-pointer border-naranja bg-naranja/6 shadow-[inset_0_0_0_0.5px_var(--color-naranja)]"
            : "cursor-pointer border-linea-fuerte hover:border-texto/25"
      } ${className}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          disabled={disabled}
          onChange={() => onChange(value)}
          className="mt-0.5 size-4 shrink-0 accent-naranja"
        />
        <div className="min-w-0">
          <p className="font-medium text-texto">{titulo}</p>
          {detalle && <p className="text-sm text-atenuado">{detalle}</p>}
        </div>
      </div>
      {derecha && <div className="shrink-0 text-right">{derecha}</div>}
    </label>
  );
}
