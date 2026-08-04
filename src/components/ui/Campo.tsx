/**
 * Un único origen para el aspecto de los campos. Antes `CLASE_CAMPO` vivía en
 * `forms/Field.tsx` y estaba copiada literalmente en `Select.tsx` y en
 * `SelectorGeografico.tsx`, así que los tres se separaban en cuanto alguien
 * tocaba uno.
 *
 * **El foco es un borde azul de 1.5px**, no el contorno naranja global: el
 * naranja está reservado a la acción y un formulario largo con el campo activo
 * en naranja compite con su propio botón de envío.
 *
 * Se consigue con borde de 1px más una sombra interior de media: un borde real
 * de 1.5px desplaza el contenido medio píxel y el campo «salta» al enfocarlo.
 */
const FOCO_AZUL =
  "focus:border-azul focus:shadow-[inset_0_0_0_0.5px_var(--color-azul)] focus:outline-none";

export const CLASE_CAMPO =
  "h-11 w-full rounded-md border border-linea-fuerte bg-superficie px-3.5 text-sm text-texto " +
  `transition-colors placeholder:text-mudo ${FOCO_AZUL} ` +
  "disabled:cursor-not-allowed disabled:opacity-55";

/** Variante para `<textarea>`, que necesita alto libre en vez de los 44px. */
export const CLASE_AREA =
  "w-full rounded-md border border-linea-fuerte bg-superficie px-3.5 py-2.5 text-sm text-texto " +
  `transition-colors placeholder:text-mudo ${FOCO_AZUL} ` +
  "disabled:cursor-not-allowed disabled:opacity-55";

/** Para dorsales, importes y códigos: el diseño exige mono en todo dato numérico. */
export const CLASE_CAMPO_MONO = `${CLASE_CAMPO} font-mono`;

export function Etiqueta({
  htmlFor,
  children,
  required = false,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    // Etiqueta mono en versalitas, no texto corriente: es el rótulo de un dato,
    // y el diseño reserva Archivo para el contenido y mono para los rótulos.
    <label
      htmlFor={htmlFor}
      className="font-mono text-[0.6875rem] font-semibold uppercase tracking-etiqueta text-mudo"
    >
      {children}
      {required && <span className="text-naranja"> *</span>}
    </label>
  );
}

/** El error tapa a la ayuda: si el campo está mal, lo que hay que leer es el error. */
export function AyudaError({ ayuda, errors }: { ayuda?: string; errors?: string[] }) {
  if (errors?.[0]) return <p className="text-sm text-red-300">{errors[0]}</p>;
  if (ayuda) return <p className="text-xs text-mudo">{ayuda}</p>;
  return null;
}

export function Campo({
  label,
  name,
  type = "text",
  required = false,
  errors,
  defaultValue,
  value,
  placeholder,
  step,
  min,
  max,
  ayuda,
  disabled = false,
  className = "",
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  errors?: string[];
  defaultValue?: string | number;
  /**
   * Vuelve el campo controlado, para los que el sistema rellena solo (el slug a
   * partir del nombre). Exige `onChange`; sin él el campo sería de solo lectura
   * de hecho, que no es lo que nadie espera al ver un input.
   */
  value?: string;
  placeholder?: string;
  step?: string | number;
  min?: string | number;
  max?: string | number;
  /** Texto de apoyo bajo el campo: explica el formato o la consecuencia de cambiarlo. */
  ayuda?: string;
  disabled?: boolean;
  className?: string;
  /** Para pantallas que derivan algo del valor mientras se escribe. */
  onChange?: (valor: string) => void;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Etiqueta htmlFor={name} required={required}>
        {label}
      </Etiqueta>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        // `value` manda si viene; si no, el campo sigue siendo no controlado.
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={CLASE_CAMPO}
      />
      <AyudaError ayuda={ayuda} errors={errors} />
    </div>
  );
}
