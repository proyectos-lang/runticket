import type { EstadoEmpresa, RolEmpresa } from "@/lib/supabase/database.types";

/**
 * Estado de una empresa organizadora.
 *
 * `en prueba` va en cian y no en ámbar: no es un aviso de que algo falle, es el
 * estado normal de una empresa recién dada de alta.
 */
const EMPRESA: Record<EstadoEmpresa, { texto: string; clase: string }> = {
  activa: { texto: "Activa", clase: "border border-emerald-500/34 bg-emerald-500/14 text-verde" },
  prueba: { texto: "En prueba", clase: "border border-cian/36 bg-cian/12 text-cian" },
  suspendida: { texto: "Suspendida", clase: "border border-red-500/40 bg-red-500/12 text-rojo" },
};

export function ChipEstadoEmpresa({ estado }: { estado: EstadoEmpresa }) {
  const c = EMPRESA[estado];
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.25 font-mono text-[0.5625rem] font-bold uppercase tracking-etiqueta ${c.clase}`}
    >
      {c.texto}
    </span>
  );
}

/**
 * Rol de una persona.
 *
 * El administrador de empresa va en naranja porque es quien manda dentro de su
 * empresa; el operador y el super-admin en azul, que aquí es color de dato y no
 * de acción. Ninguno es un botón, así que el naranja no compite con nada.
 */
export type Rol = RolEmpresa | "super_admin";

const ROL: Record<Rol, { texto: string; clase: string }> = {
  admin_empresa: {
    texto: "Administrador",
    clase: "border border-naranja/38 bg-naranja/13 text-naranja-suave",
  },
  operador: { texto: "Operador", clase: "border border-azul/36 bg-azul/14 text-azul-texto" },
  super_admin: {
    texto: "Super-admin",
    clase: "border border-azul/42 bg-azul/16 text-azul-texto",
  },
};

export function ChipRol({ rol }: { rol: Rol }) {
  const c = ROL[rol];
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.25 font-mono text-[0.5625rem] font-bold uppercase tracking-etiqueta ${c.clase}`}
    >
      {c.texto}
    </span>
  );
}

/**
 * Acción registrada en la bitácora.
 *
 * El tono lo decide lo que pasó con el dinero, no la severidad: confirmar cobra
 * (verde), rechazar no cobra (rojo), y lo que queda a la espera va en ámbar
 * porque alguien tendrá que volver a mirarlo.
 */
const ACCION: Record<string, { texto: string; clase: string }> = {
  inscripcion_creada: { texto: "Inscripción creada", clase: "border border-cian/36 bg-cian/12 text-cian" },
  inscripcion_anulada: { texto: "Inscripción anulada", clase: "bg-texto/8 text-atenuado" },
  pago_confirmado: { texto: "Pago confirmado", clase: "border border-emerald-500/34 bg-emerald-500/14 text-verde" },
  pago_rechazado: { texto: "Pago rechazado", clase: "border border-red-500/40 bg-red-500/12 text-rojo" },
  pago_reembolsado: { texto: "Pago reembolsado", clase: "bg-texto/8 text-atenuado" },
  pago_anulado: { texto: "Pago anulado", clase: "bg-texto/8 text-atenuado" },
  pago_en_verificacion: {
    texto: "Pago en verificación",
    clase: "border border-amber-500/38 bg-amber-500/14 text-ambar",
  },
  pago_pendiente: { texto: "Pago pendiente", clase: "border border-amber-500/38 bg-amber-500/14 text-ambar" },
};

export function ChipAccionAuditoria({ accion }: { accion: string }) {
  // Una acción nueva que todavía no tenga tono se pinta neutra en vez de
  // romper: la bitácora es un registro legal y no puede dejar de mostrarse.
  const c = ACCION[accion] ?? {
    texto: accion.replace(/_/g, " "),
    clase: "bg-texto/8 text-atenuado",
  };
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.25 font-mono text-[0.5625rem] font-bold uppercase tracking-etiqueta ${c.clase}`}
    >
      {c.texto}
    </span>
  );
}

/** Etiqueta de ámbito bajo el wordmark: esta consola es la plataforma entera. */
export function PlacaAmbito({ texto = "Plataforma" }: { texto?: string }) {
  return (
    <span className="inline-flex w-fit rounded-[0.3125rem] border border-azul/40 bg-azul/16 px-2.25 py-1 font-mono text-[0.5625rem] font-bold uppercase tracking-etiqueta text-azul-texto">
      {texto}
    </span>
  );
}

/**
 * Acción destructiva y reversible, aislada en su propia caja roja.
 *
 * La descripción tiene que decir la **consecuencia real**: suspender oculta las
 * carreras y bloquea al equipo, pero no borra inscripciones ni pagos. Sin eso,
 * nadie se atreve a pulsarlo o lo pulsa creyendo que borra.
 */
export function ZonaPeligrosa({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-500/40 px-5 py-4.5">
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-[0.8125rem] font-bold text-rojo">{titulo}</p>
        <p className="max-w-140 text-[0.78125rem] leading-relaxed text-atenuado">{descripcion}</p>
      </div>
      {children}
    </section>
  );
}
