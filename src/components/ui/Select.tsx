import { AyudaError, CLASE_CAMPO, Etiqueta } from "./Campo";

export function Select({
  label,
  name,
  opciones,
  required = false,
  errors,
  defaultValue,
  value,
  placeholder = "Selecciona…",
  ayuda,
  className = "",
  onChange,
}: {
  label: string;
  name: string;
  opciones: readonly { valor: string; etiqueta: string }[];
  required?: boolean;
  errors?: string[];
  defaultValue?: string;
  /**
   * Vuelve el desplegable controlado, para las pantallas que derivan su valor
   * del estado. Exige `onChange`; sin él quedaría de solo lectura de hecho.
   */
  value?: string;
  placeholder?: string;
  ayuda?: string;
  className?: string;
  /** Para pantallas que derivan algo del valor elegido. */
  onChange?: (valor: string) => void;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Etiqueta htmlFor={name} required={required}>
        {label}
      </Etiqueta>
      <select
        id={name}
        name={name}
        required={required}
        // `value` manda si viene; si no, sigue siendo no controlado.
        value={value}
        defaultValue={value === undefined ? (defaultValue ?? "") : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={CLASE_CAMPO}
      >
        <option value="">{placeholder}</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
      <AyudaError ayuda={ayuda} errors={errors} />
    </div>
  );
}
