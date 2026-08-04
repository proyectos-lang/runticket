"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen, esImagenSoportada, PRESETS } from "@/lib/imagenes/comprimir";
import { rutaAvatar } from "@/lib/storage/rutas";
import { guardarFotoPerfil, quitarFotoPerfil } from "@/app/portal/perfil/actions";

/**
 * Foto de perfil del corredor.
 *
 * Un solo `<input type="file" accept="image/*">` **sin** el atributo `capture`.
 * Puede parecer poco, pero es justo lo que da la mejor experiencia en todos los
 * dispositivos a la vez: en Android e iOS el sistema abre su propio menú con
 * «Cámara», «Fototeca» y «Archivos», y en escritorio abre el explorador. Poner
 * `capture` forzaría la cámara y dejaría fuera la galería, que es de donde
 * saca la foto casi todo el mundo.
 *
 * En escritorio se añade arrastrar y soltar, que ahí sí se espera y en móvil no
 * existe.
 *
 * La imagen se sube directa a Storage con la sesión del usuario, así que la
 * política del bucket (primera carpeta = su id) se evalúa de verdad; la acción
 * de servidor solo guarda la URL después de comprobar que es suya.
 */
export function SubidorAvatar({
  fotoInicial,
  nombre,
}: {
  fotoInicial: string | null;
  nombre: string;
}) {
  const [foto, setFoto] = useState(fotoInicial);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);

  const iniciales =
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  async function procesar(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);

    if (!esImagenSoportada(archivo)) {
      setError(
        archivo.name.toLowerCase().endsWith(".heic")
          ? "Las fotos HEIC del iPhone hay que exportarlas como JPG."
          : "Ese archivo no es una imagen. Usa JPG, PNG o WebP."
      );
      return;
    }

    setSubiendo(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tu sesión caducó. Vuelve a entrar.");

      const { blob, extension } = await comprimirImagen(archivo, PRESETS.avatar);
      const ruta = rutaAvatar(user.id, `avatar-${Date.now()}.${extension}`);

      const { error: fallo } = await supabase.storage
        .from("avatares")
        .upload(ruta, blob, { contentType: blob.type });
      if (fallo) throw new Error(fallo.message);

      const { data } = supabase.storage.from("avatares").getPublicUrl(ruta);
      // Optimista: la foto se ve en cuanto sube, sin esperar al servidor.
      setFoto(data.publicUrl);
      startTransition(async () => {
        try {
          await guardarFotoPerfil(data.publicUrl);
        } catch (e) {
          setFoto(fotoInicial);
          setError(e instanceof Error ? e.message : "No se pudo guardar la foto.");
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
    }
  }

  const ocupado = subiendo || pendiente;

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          void procesar(e.dataTransfer.files?.[0]);
        }}
        className="relative"
      >
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={ocupado}
          aria-label={foto ? "Cambiar mi foto de perfil" : "Añadir una foto de perfil"}
          className={`group relative size-28 overflow-hidden rounded-full border-2 transition-colors disabled:cursor-wait ${
            encima ? "border-naranja bg-naranja/10" : "border-naranja/70 hover:border-naranja"
          }`}
        >
          {foto ? (
            <Image src={foto} alt="" fill sizes="112px" className="object-cover" />
          ) : (
            // Iniciales en vez de un icono genérico: identifican de un vistazo y
            // no dejan el hueco con pinta de estar roto mientras no haya foto.
            <span className="flex size-full items-center justify-center bg-superficie-2 font-mono text-2xl font-bold text-texto/35">
              {iniciales}
            </span>
          )}

          {/* La capa aparece al pasar el ratón y siempre en táctil, donde no
              existe el hover y si no nada indicaría que se puede pulsar. */}
          <span className="absolute inset-x-0 bottom-0 flex h-9 items-center justify-center bg-tinta/75 font-mono text-[0.5625rem] font-bold uppercase tracking-etiqueta text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            {ocupado ? "Subiendo…" : foto ? "Cambiar" : "Añadir"}
          </span>
        </button>
      </div>

      <input
        ref={entrada}
        type="file"
        // Sin `capture`: así el móvil ofrece cámara, galería y archivos, en vez
        // de abrir la cámara y nada más.
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        onChange={(e) => {
          void procesar(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="flex flex-col items-center gap-1">
        <p className="text-center text-xs text-mudo">
          Tócala para hacerte una foto o elegir una.{" "}
          <span className="hidden sm:inline">También puedes arrastrarla aquí.</span>
        </p>
        {foto && !ocupado && (
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                try {
                  await quitarFotoPerfil();
                  setFoto(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "No se pudo quitar la foto.");
                }
              })
            }
            className="text-xs underline-offset-2 hover:underline text-atenuado"
          >
            Quitar foto
          </button>
        )}
      </div>

      {error && <p className="max-w-64 text-center text-sm text-rojo">{error}</p>}
    </div>
  );
}
