"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Captura una firma manuscrita con eventos de puntero (funciona con dedo, lápiz
 * y ratón) y la expone como PNG en un input oculto para que viaje con el form.
 */
export function FirmaCanvas({
  name,
  alCambiar,
}: {
  name: string;
  /** Se llama con true en cuanto hay trazo y con false al borrar. */
  alCambiar?: (firmado: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  /** Si de verdad se pintó algo. Un toque suelto no es una firma. */
  const pintado = useRef(false);
  const [dataUrl, setDataUrl] = useState("");

  /**
   * Ajustar el lienzo a su tamaño real, **cuando lo tenga**.
   *
   * Medir una sola vez al montar no valía. En el formulario de inscripción la
   * firma vive en el tercer paso del asistente, y los pasos se ocultan con
   * `display:none` en vez de desmontarse (a propósito: si se desmontaran, sus
   * campos saldrían del DOM y no viajarían en el envío). Un elemento oculto mide
   * **cero**, así que el lienzo nacía de 0×0 píxeles: se veía el recuadro blanco,
   * que es CSS, pero el trazo caía fuera del mapa de bits y no aparecía nada.
   *
   * Peor todavía, `toDataURL` de un lienzo sin píxeles devuelve `"data:,"`, de
   * modo que la declaración se firmaba «en blanco» sin que nadie se enterara.
   *
   * Con `ResizeObserver` se ajusta en cuanto el paso se muestra, y también si la
   * ventana cambia de ancho o el móvil se gira.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ajustar = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (!width || !height) return; // sigue oculto: nada que ajustar todavía

      // A la resolución real del dispositivo, para que no se vea pixelada.
      const dpr = window.devicePixelRatio || 1;
      const ancho = Math.round(width * dpr);
      const alto = Math.round(height * dpr);
      if (canvas.width === ancho && canvas.height === alto) return;

      // Cambiar el tamaño **borra** el lienzo, así que lo que hubiera se guarda
      // antes y se vuelve a pintar: girar el teléfono no puede tragarse una
      // firma a medio hacer.
      const previo = document.createElement("canvas");
      if (canvas.width > 0 && canvas.height > 0) {
        previo.width = canvas.width;
        previo.height = canvas.height;
        previo.getContext("2d")?.drawImage(canvas, 0, 0);
      }

      canvas.width = ancho;
      canvas.height = alto;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // `setTransform` y no `scale`: `scale` multiplica la transformación
      // vigente, y aquí esto se ejecuta más de una vez.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#18181b";

      // En coordenadas CSS, que es en lo que trabaja el contexto ya escalado.
      if (previo.width > 0) ctx.drawImage(previo, 0, 0, width, height);
    };

    ajustar();
    const observador = new ResizeObserver(ajustar);
    observador.observe(canvas);
    return () => observador.disconnect();
  }, []);

  function posicion(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = posicion(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    dibujando.current = true;
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = posicion(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    pintado.current = true;
  }

  function terminar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    dibujando.current = false;
    if (!pintado.current) return; // un toque sin arrastrar no deja trazo

    const png = e.currentTarget.toDataURL("image/png");
    // Un lienzo sin píxeles devuelve `"data:,"`. Antes eso se daba por firma
    // buena y el botón de confirmar se habilitaba con la declaración en blanco.
    if (!png.startsWith("data:image/png;base64,")) return;

    setDataUrl(png);
    alCambiar?.(true);
  }

  function limpiar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    // En coordenadas CSS: el contexto está escalado por el `dpr`, así que usar
    // `canvas.width` borraría un área varias veces mayor que el lienzo.
    const { width, height } = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, width, height);
    pintado.current = false;
    setDataUrl("");
    alCambiar?.(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-etiqueta text-mudo">
          Firma del corredor
        </span>
        <button
          type="button"
          onClick={limpiar}
          className="text-xs font-medium text-cian transition-colors hover:underline"
        >
          Borrar
        </button>
      </div>

      {/*
        El lienzo es blanco y el trazo oscuro **porque acaba dentro de un PDF**.
        Es, junto a la placa del QR, el único blanco autorizado del sistema:
        invertirlo por coherencia visual haría desaparecer la firma del documento.
      */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerLeave={terminar}
          className="relative z-10 h-[9.375rem] w-full touch-none rounded-lg border border-texto/20 bg-white"
          aria-label="Área de firma"
        />
        {/* Guía y pista van bajo el lienzo: pintarlas dentro obligaría a
            redibujarlas tras cada borrado y acabarían en el PNG del PDF. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 bottom-[2.125rem] z-20 h-px bg-[#d4d8de]"
        />
        {!dataUrl && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-4 top-3 z-20 font-mono text-[0.65625rem] font-medium text-[#8a9099]"
          >
            Firma con el dedo o el ratón
          </span>
        )}
      </div>

      {dataUrl && <span className="text-xs text-cian">Firma capturada.</span>}
      <input type="hidden" name={name} value={dataUrl} />
    </div>
  );
}
