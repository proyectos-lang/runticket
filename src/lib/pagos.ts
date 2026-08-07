import type { EstadoPago, MetodoPago } from "@/lib/supabase/database.types";
import type { Tono } from "@/lib/tonos";
import { formatPrecio } from "@/lib/format";

export const ESTADO_PAGO_LABEL: Record<EstadoPago, string> = {
  pendiente: "Pendiente de pago",
  en_verificacion: "En verificación",
  pagado: "Pagado",
  rechazado: "Rechazado",
  reembolsado: "Reembolsado",
  anulado: "Anulado",
};

export const ESTADO_PAGO_TONO: Record<EstadoPago, Tono> = {
  pendiente: "neutro",
  en_verificacion: "aviso",
  pagado: "exito",
  rechazado: "error",
  reembolsado: "info",
  anulado: "neutro",
};

export const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  whatsapp: "Coordinado por WhatsApp",
  pasarela: "Pasarela bancaria",
  comprobante_transferencia: "Comprobante de transferencia",
  efectivo: "Efectivo",
  manual: "Registro manual",
};

/**
 * Enlace wa.me con el mensaje precargado. Se queda en el número del organizador
 * para que el corredor no tenga que explicar nada: el mensaje ya lleva la
 * referencia de la inscripción, el evento, la categoría y el monto.
 */
export function enlaceWhatsApp(datos: {
  telefonoOrganizador: string;
  /** Identificador que el organizador buscará: la inscripción o el grupo. */
  referencia: string;
  corredor: string;
  evento: string;
  /** Vacío cuando el mensaje cubre a varias personas con distintas distancias. */
  categoria?: string | null;
  /** Más de una convierte el mensaje en el de una familia. */
  personas?: number;
  monto: number;
  moneda: string;
}): string {
  // wa.me exige el número sin espacios, guiones ni signo +.
  const numero = datos.telefonoOrganizador.replace(/[^0-9]/g, "");
  const varias = (datos.personas ?? 1) > 1;

  const mensaje = [
    varias
      ? `Hola, quiero coordinar el pago de ${datos.personas} inscripciones en ${datos.evento}.`
      : `Hola, quiero coordinar el pago de mi inscripción en ${datos.evento}.`,
    "",
    varias ? `A nombre de: ${datos.corredor}` : `Corredor: ${datos.corredor}`,
    ...(datos.categoria ? [`Categoría: ${datos.categoria}`] : []),
    `Monto: ${formatPrecio(datos.monto, datos.moneda)}`,
    `Referencia: ${datos.referencia}`,
  ].join("\n");
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

export type ResumenConciliacion = {
  totalPagado: number;
  totalPendiente: number;
  totalEnVerificacion: number;
  porMetodo: { metodo: MetodoPago; total: number; cantidad: number }[];
  porDia: { dia: string; total: number; cantidad: number }[];
};

/**
 * Agrega los totales en memoria: el volumen por evento es manejable y evita
 * mantener vistas de agregación en la base de datos.
 */
export function resumirConciliacion(
  pagos: { monto: number; metodo: MetodoPago; estado: EstadoPago; verificado_en: string | null; created_at: string }[]
): ResumenConciliacion {
  const pagados = pagos.filter((p) => p.estado === "pagado");

  const porMetodo = new Map<MetodoPago, { total: number; cantidad: number }>();
  for (const p of pagados) {
    const actual = porMetodo.get(p.metodo) ?? { total: 0, cantidad: 0 };
    porMetodo.set(p.metodo, { total: actual.total + Number(p.monto), cantidad: actual.cantidad + 1 });
  }

  const porDia = new Map<string, { total: number; cantidad: number }>();
  for (const p of pagados) {
    // Se cuenta el día en que se confirmó el cobro, no el de la inscripción.
    const dia = (p.verificado_en ?? p.created_at).slice(0, 10);
    const actual = porDia.get(dia) ?? { total: 0, cantidad: 0 };
    porDia.set(dia, { total: actual.total + Number(p.monto), cantidad: actual.cantidad + 1 });
  }

  const suma = (estado: EstadoPago) =>
    pagos.filter((p) => p.estado === estado).reduce((acc, p) => acc + Number(p.monto), 0);

  return {
    totalPagado: suma("pagado"),
    totalPendiente: suma("pendiente"),
    totalEnVerificacion: suma("en_verificacion"),
    porMetodo: [...porMetodo.entries()]
      .map(([metodo, v]) => ({ metodo, ...v }))
      .sort((a, b) => b.total - a.total),
    porDia: [...porDia.entries()].map(([dia, v]) => ({ dia, ...v })).sort((a, b) => a.dia.localeCompare(b.dia)),
  };
}
