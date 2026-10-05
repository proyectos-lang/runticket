import { redirect } from "next/navigation";

/**
 * Vuelve a una pantalla con un mensaje para ella.
 *
 * Es la salida de las acciones de servidor que se invocan desde un `<form>` sin
 * `useActionState`: no tienen dónde devolver un estado, y lanzar un error las
 * mandaba a la pantalla genérica de «algo falló». La página destino lee
 * `?aviso=` y lo enseña arriba, en su sitio.
 */
export function redirigirConAviso(ruta: string, aviso: string): never {
  const separador = ruta.includes("?") ? "&" : "?";
  redirect(`${ruta}${separador}aviso=${encodeURIComponent(aviso)}`);
}

/** Texto de un error de Supabase sin el prefijo técnico que a veces antepone. */
export function mensajeDe(error: unknown, porDefecto = "Algo falló. Inténtalo de nuevo."): string {
  if (error instanceof Error && error.message) return error.message.replace(/^.*?:\s*/, "");
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return porDefecto;
}
