/**
 * Compresión en el navegador, sin dependencias. Una foto de móvil ronda los 4 MB
 * y queda en 150–250 kB, lo que ahorra ancho de banda al organizador (que muchas
 * veces sube desde datos móviles) y hace que la página pública cargue rápido.
 *
 * Solo puede ejecutarse en el cliente: usa canvas y createImageBitmap.
 */

export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

export type OpcionesCompresion = {
  /** Lado mayor en píxeles; la imagen se reduce proporcionalmente. */
  ladoMaximo: number;
  calidad?: number;
};

export const PRESETS = {
  banner: { ladoMaximo: 1600 },
  galeria: { ladoMaximo: 1200 },
  logo: { ladoMaximo: 512 },
} satisfies Record<string, OpcionesCompresion>;

export function esImagenSoportada(archivo: File): boolean {
  return (TIPOS_IMAGEN as readonly string[]).includes(archivo.type);
}

export async function comprimirImagen(
  archivo: File,
  { ladoMaximo, calidad = 0.82 }: OpcionesCompresion
): Promise<{ blob: Blob; extension: string }> {
  // `imageOrientation: "from-image"` respeta el EXIF; sin él, las fotos tomadas
  // en vertical con el móvil salen giradas.
  const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });

  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no permite procesar la imagen.");
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const webp = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/webp", calidad));
  if (webp) return { blob: webp, extension: "webp" };

  // Safari antiguo no codifica webp desde canvas.
  const jpeg = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/jpeg", 0.85));
  if (jpeg) return { blob: jpeg, extension: "jpg" };

  throw new Error("No se pudo procesar la imagen.");
}
