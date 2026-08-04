/**
 * Convenciones de Storage.
 *
 * Las políticas de la migración 0009 exigen que **el primer segmento de la ruta sea
 * el empresa_id**: es lo que comprueban con `storage.foldername(name)[1]`. Cualquier
 * ruta que no lo respete será rechazada por Storage, no por el cliente.
 *
 * Asimetría deliberada en lo que se guarda en la base de datos:
 *   - Buckets PÚBLICOS  → se guarda la URL completa (next/image la consume directa,
 *     y next.config.ts ya autoriza /storage/v1/object/public/**).
 *   - Buckets PRIVADOS  → se guarda la ruta relativa, porque hay que firmar una URL
 *     temporal en cada lectura (así lo hace ya el flujo de inscripción).
 */

export const BUCKETS_PUBLICOS = ["logos-empresa", "eventos", "fotos-evento"] as const;
export const BUCKETS_PRIVADOS = ["comprobantes", "declaraciones", "certificados"] as const;

export type BucketPublico = (typeof BUCKETS_PUBLICOS)[number];

/** Nombre de archivo seguro: sin rutas relativas, espacios ni acentos. */
export function nombreSeguro(original: string, prefijo: string): string {
  const extension = original.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "bin";
  return `${prefijo}-${Date.now()}.${extension}`;
}

export const rutaLogoEmpresa = (empresaId: string, archivo: string) => `${empresaId}/${archivo}`;

export const rutaEvento = (empresaId: string, eventoId: string, archivo: string) =>
  `${empresaId}/${eventoId}/${archivo}`;

/** Prefijo de todos los archivos de un evento; se usa al borrarlo. */
export const prefijoEvento = (empresaId: string, eventoId: string) => `${empresaId}/${eventoId}`;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Valida en el servidor que una URL pública apunte de verdad al bucket y a la carpeta
 * que corresponden. El cliente sube el archivo directamente, así que la URL que llega
 * en el formulario no es de fiar: sin esta comprobación alguien podría guardar en su
 * evento la URL de cualquier otro sitio.
 */
export function urlPublicaValida(
  url: string,
  bucket: BucketPublico,
  carpeta: string
): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  const prefijo = `${base}/storage/v1/object/public/${bucket}/${carpeta}/`;
  if (!url.startsWith(prefijo)) return false;
  // Nada de subir un nivel para escaparse de la carpeta.
  return !url.slice(prefijo.length).includes("..");
}

/** Extrae la ruta dentro del bucket a partir de una URL pública, para poder borrarla. */
export function rutaDesdeUrlPublica(url: string, bucket: BucketPublico): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const prefijo = `${base}/storage/v1/object/public/${bucket}/`;
  return url.startsWith(prefijo) ? url.slice(prefijo.length) : null;
}

export const ES_CARPETA_EVENTO = new RegExp(`^${UUID}/${UUID}$`);
