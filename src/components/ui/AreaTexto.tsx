import { AyudaError, CLASE_AREA, Etiqueta } from "./Campo";

export function AreaTexto({
  label,
  name,
  rows = 4,
  required = false,
  errors,
  defaultValue,
  placeholder,
  ayuda,
  className = "",
}: {
  label: string;
  name: string;
  rows?: number;
  required?: boolean;
  errors?: string[];
  defaultValue?: string;
  placeholder?: string;
  ayuda?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Etiqueta htmlFor={name} required={required}>
        {label}
      </Etiqueta>
      <textarea
        id={name}
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={CLASE_AREA}
      />
      <AyudaError ayuda={ayuda} errors={errors} />
    </div>
  );
}
