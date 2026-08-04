import type { Tono } from "@/lib/tonos";

const TONOS_CIFRA: Record<Tono, string> = {
  neutro: "text-texto",
  exito: "text-emerald-300",
  aviso: "text-amber-300",
  error: "text-red-300",
  info: "text-cian",
  acento: "text-naranja",
};

/**
 * Etiqueta corta en versalitas monoespaciadas. Es el recurso que el diseño usa
 * para rotular datos sin gastar jerarquía tipográfica.
 */
export function EtiquetaMono({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-mono text-[0.6875rem] uppercase tracking-etiqueta text-mudo ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Cifra grande con su rótulo. `tabular` es obligatorio: sin cifras tabulares,
 * una fila de tarjetas con importes distintos baila al actualizarse.
 */
export function TarjetaMetrica({
  etiqueta,
  valor,
  detalle,
  tono = "neutro",
  className = "",
}: {
  etiqueta: React.ReactNode;
  valor: React.ReactNode;
  detalle?: React.ReactNode;
  tono?: Tono;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-linea bg-superficie px-5 py-4 ${className}`}>
      <EtiquetaMono>{etiqueta}</EtiquetaMono>
      <p
        className={`tabular mt-1.5 text-3xl font-semibold tracking-display ${TONOS_CIFRA[tono]}`}
      >
        {valor}
      </p>
      {detalle && <p className="mt-1 text-sm text-atenuado">{detalle}</p>}
    </div>
  );
}

/**
 * Relleno para las imágenes que faltan (portada sin subir, mapa sin trazado).
 * La trama diagonal es deliberada: un gris plano se confunde con una foto que
 * no cargó. El texto describe qué va ahí, no dice «sin imagen».
 */
export function PlaceholderMedia({
  etiqueta,
  variante = "neutra",
  className = "",
}: {
  etiqueta?: React.ReactNode;
  /** `calida` para carrera nocturna, `fria` para ciclismo y mapas. */
  variante?: "neutra" | "calida" | "fria";
  className?: string;
}) {
  const trama = { neutra: "trama", calida: "trama trama-calida", fria: "trama trama-fria" }[
    variante
  ];
  return (
    <div aria-hidden className={`flex items-center justify-center ${trama} ${className}`}>
      {etiqueta && (
        <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-etiqueta text-texto/35">
          {etiqueta}
        </span>
      )}
    </div>
  );
}

/**
 * Placa clara bajo los logos de terceros.
 *
 * Un logo con transparencia y tinta oscura —el caso normal en patrocinadores
 * hondureños— desaparece sobre #0E1116. Eso es rotura de contenido, no de
 * estilo, así que estos son los únicos elementos claros autorizados fuera del
 * lienzo de la firma.
 */
export function PlacaLogo({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center rounded-xl bg-texto p-3 ${className}`}>
      {children}
    </div>
  );
}
