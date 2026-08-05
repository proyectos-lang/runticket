"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { comprimirImagen, esImagenSoportada, PRESETS } from "@/lib/imagenes/comprimir";
import { rutaAvatar } from "@/lib/storage/rutas";
import { Boton } from "@/components/ui/Boton";
import { guardarFotoPerfil, quitarFotoPerfil } from "@/app/portal/perfil/actions";

/**
 * Foto de perfil del corredor.
 *
 * Tres decisiones que vienen de ver fallar la versión anterior:
 *
 * 1. **Se elige con un botón rotulado, no pulsando el círculo.** Antes el único
 *    modo de abrir el selector era tocar el avatar, y un círculo sin texto no
 *    dice que se pueda pulsar. Peor: si su clase de tamaño no llega a
 *    generarse, el botón queda de 4×4 px y no hay literalmente dónde pulsar.
 *    Con un botón de texto, el control se ve y funciona pase lo que pase.
 *
 * 2. **La foto se revisa antes de subirla.** Al elegirla se muestra en grande,
 *    ya recortada como quedará, y hasta que no se confirma no sale del
 *    dispositivo. Antes se subía y guardaba de golpe, sin ocasión de mirarla.
 *
 * 3. **Un solo `<input type="file">` sin `capture`**: en Android e iOS el
 *    sistema ofrece cámara, fototeca y archivos; en escritorio, el explorador y
 *    arrastrar y soltar. Forzar la cámara dejaría fuera la galería, que es de
 *    donde sale casi toda foto de perfil.
 */
export function SubidorAvatar({
  fotoInicial,
  nombre,
}: {
  fotoInicial: string | null;
  nombre: string;
}) {
  const [guardada, setGuardada] = useState(fotoInicial);
  /** Foto elegida y pendiente de que la persona la apruebe. */
  const [propuesta, setPropuesta] = useState<{ blob: Blob; extension: string; url: string } | null>(
    null
  );
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encima, setEncima] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);

  // La vista previa vive en memoria del navegador; hay que liberarla o se queda
  // ocupada mientras dure la pestaña.
  useEffect(() => {
    return () => {
      if (propuesta) URL.revokeObjectURL(propuesta.url);
    };
  }, [propuesta]);

  const iniciales =
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  async function elegir(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);

    if (!esImagenSoportada(archivo)) {
      setError(
        archivo.name.toLowerCase().endsWith(".heic")
          ? "Las fotos HEIC del iPhone hay que exportarlas como JPG antes de subirlas."
          : "Ese archivo no es una imagen. Usa JPG, PNG o WebP."
      );
      return;
    }

    setTrabajando(true);
    try {
      // Se comprime y recorta **antes** de enseñarla: así la vista previa es la
      // foto de verdad, no el original, y no se aprueba una cosa para acabar
      // guardando otra.
      const { blob, extension } = await comprimirImagen(archivo, PRESETS.avatar);
      if (propuesta) URL.revokeObjectURL(propuesta.url);
      setPropuesta({ blob, extension, url: URL.createObjectURL(blob) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer la imagen.");
    } finally {
      setTrabajando(false);
    }
  }

  async function confirmar() {
    if (!propuesta) return;
    setError(null);
    setTrabajando(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Tu sesión caducó. Vuelve a entrar.");

      const ruta = rutaAvatar(user.id, `avatar-${Date.now()}.${propuesta.extension}`);
      const { error: fallo } = await supabase.storage
        .from("avatares")
        .upload(ruta, propuesta.blob, { contentType: propuesta.blob.type });
      if (fallo) throw new Error(fallo.message);

      const { data } = supabase.storage.from("avatares").getPublicUrl(ruta);
      startTransition(async () => {
        try {
          await guardarFotoPerfil(data.publicUrl);
          setGuardada(data.publicUrl);
          URL.revokeObjectURL(propuesta.url);
          setPropuesta(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "No se pudo guardar la foto.");
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setTrabajando(false);
    }
  }

  function descartar() {
    if (propuesta) URL.revokeObjectURL(propuesta.url);
    setPropuesta(null);
    setError(null);
  }

  const ocupado = trabajando || pendiente;
  const aVista = propuesta?.url ?? guardada;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setEncima(true);
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault();
        setEncima(false);
        void elegir(e.dataTransfer.files?.[0]);
      }}
      className={`flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-6 transition-colors ${
        encima ? "border-naranja bg-naranja/8" : "border-transparent"
      }`}
    >
      {/* Círculo de vista previa. Es solo presentación: no se pulsa, y por eso
          no pasa nada si algún día no se pinta como debe. */}
      <div className="relative size-32 shrink-0 overflow-hidden rounded-full border-2 border-naranja/70">
        {aVista ? (
          propuesta ? (
            // Vista previa local (blob:); el optimizador de next/image no la
            // sirve, así que aquí va una etiqueta corriente.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={propuesta.url} alt="Vista previa de tu foto" className="size-full object-cover" />
          ) : (
            <Image src={guardada!} alt="Tu foto de perfil" fill sizes="128px" className="object-cover" />
          )
        ) : (
          // Iniciales en vez de un icono genérico: identifican de un vistazo y
          // no dejan el hueco con pinta de estar roto.
          <span className="flex size-full items-center justify-center bg-superficie-2 font-mono text-3xl font-bold text-texto/35">
            {iniciales}
          </span>
        )}
      </div>

      <input
        ref={entrada}
        type="file"
        // Sin `capture`: el móvil ofrece cámara, galería y archivos.
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        onChange={(e) => {
          void elegir(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {propuesta ? (
        // ── Revisión: la foto todavía no ha salido del dispositivo ───────────
        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-sm text-atenuado">
            Así quedará tu foto. ¿La usamos?
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Boton variante="primaria" onClick={confirmar} disabled={ocupado}>
              {ocupado ? "Guardando…" : "Usar esta foto"}
            </Boton>
            <Boton variante="secundaria" onClick={() => entrada.current?.click()} disabled={ocupado}>
              Elegir otra
            </Boton>
            <Boton variante="fantasma" onClick={descartar} disabled={ocupado}>
              Cancelar
            </Boton>
          </div>
        </div>
      ) : (
        // ── Reposo ───────────────────────────────────────────────────────────
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-2">
            <Boton
              variante={guardada ? "secundaria" : "primaria"}
              onClick={() => entrada.current?.click()}
              disabled={ocupado}
            >
              {ocupado ? "Un momento…" : guardada ? "Cambiar foto" : "Seleccionar foto"}
            </Boton>
            {guardada && (
              <Boton
                variante="fantasma"
                disabled={ocupado}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      await quitarFotoPerfil();
                      setGuardada(null);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "No se pudo quitar la foto.");
                    }
                  })
                }
              >
                Quitar
              </Boton>
            )}
          </div>
          <p className="max-w-72 text-center text-xs text-mudo">
            Desde el móvil puedes hacerte una foto o elegirla de tu galería.
            <span className="hidden sm:inline"> En el ordenador también puedes arrastrarla aquí.</span>
          </p>
        </div>
      )}

      {error && <p className="max-w-72 text-center text-sm text-rojo">{error}</p>}
    </div>
  );
}
