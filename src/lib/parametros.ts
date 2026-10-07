/**
 * Lectura defensiva de `searchParams`.
 *
 * Un parámetro repetido en la URL (`?next=a&next=b`) llega como array, y lo
 * que una pantalla reflejara en un enlace o en un campo oculto podía acabar
 * siendo el valor inyectado. La auditoría lo señaló como «HTTP Parameter
 * Pollution». Regla: se toma **el primero**, se recorta, y lo que se vaya a
 * reflejar se valida contra lo que puede ser.
 */
type Crudo = string | string[] | undefined;

export function primero(valor: Crudo, maximo = 200): string | undefined {
  const v = Array.isArray(valor) ? valor[0] : valor;
  if (typeof v !== "string") return undefined;
  const limpio = v.trim().slice(0, maximo);
  return limpio || undefined;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuidOpcional(valor: Crudo): string | undefined {
  const v = primero(valor, 36);
  return v && UUID.test(v) ? v : undefined;
}

/** Solo si está entre los valores permitidos. */
export function unoDe<T extends string>(valor: Crudo, permitidos: readonly T[]): T | undefined {
  const v = primero(valor, 60);
  return v && (permitidos as readonly string[]).includes(v) ? (v as T) : undefined;
}

/** Solo si cumple la expresión. */
export function conFormato(valor: Crudo, formato: RegExp, maximo = 60): string | undefined {
  const v = primero(valor, maximo);
  return v && formato.test(v) ? v : undefined;
}
