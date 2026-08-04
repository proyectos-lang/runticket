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
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // El canvas se dibuja a la resolución real del dispositivo para que la firma
    // no se vea pixelada en pantallas de alta densidad.
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#18181b";
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
  }

  function terminar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    dibujando.current = false;
    setDataUrl(e.currentTarget.toDataURL("image/png"));
    alCambiar?.(true);
  }

  function limpiar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
