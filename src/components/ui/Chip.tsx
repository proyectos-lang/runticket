import type { Estilo, Tono } from "@/lib/tonos";

/**
 * Fondos teñidos con alfa en vez de un `-950` opaco: el chip se apoya sobre
 * tres superficies distintas (#07080A, #0E1116, #141821) y con un fondo opaco
 * se recorta contra dos de ellas.
 */
const TONOS: Record<Tono, string> = {
  neutro: "bg-superficie-2 text-atenuado",
  exito: "bg-emerald-500/12 text-emerald-300",
  aviso: "bg-amber-500/12 text-amber-300",
  error: "bg-red-500/12 text-red-300",
  info: "bg-azul/15 text-cian",
  acento: "bg-naranja/15 text-naranja-suave",
};

export function Chip({
  children,
  tono = "neutro",
  className = "",
}: {
  children: React.ReactNode;
  tono?: Tono;
  className?: string;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${TONOS[tono]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Atajo para las tablas de `lib/estados.ts` y `lib/pagos.ts`. */
export function ChipEstado({ estilo, className = "" }: { estilo: Estilo; className?: string }) {
  return (
    <Chip tono={estilo.tono} className={className}>
      {estilo.etiqueta}
    </Chip>
  );
}
