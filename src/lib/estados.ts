import type {
  EstadoEmpresa,
  EstadoEvento,
  EstadoInscripcion,
  EstadoListaEspera,
  EstadoMembresia,
} from "@/lib/supabase/database.types";
import type { Estilo } from "@/lib/tonos";

export type { Estilo };

export const ESTADO_EMPRESA: Record<EstadoEmpresa, Estilo> = {
  activa: { etiqueta: "Activa", tono: "exito" },
  suspendida: { etiqueta: "Suspendida", tono: "error" },
  prueba: { etiqueta: "En prueba", tono: "aviso" },
};

export const ESTADO_EVENTO: Record<EstadoEvento, Estilo> = {
  borrador: { etiqueta: "Borrador", tono: "neutro" },
  publicado: { etiqueta: "Publicado", tono: "exito" },
  inscripciones_cerradas: { etiqueta: "Inscripciones cerradas", tono: "aviso" },
  finalizado: { etiqueta: "Finalizado", tono: "info" },
  cancelado: { etiqueta: "Cancelado", tono: "error" },
};

export const ESTADO_MEMBRESIA: Record<EstadoMembresia, Estilo> = {
  invitado: { etiqueta: "Invitación pendiente", tono: "aviso" },
  activo: { etiqueta: "Activo", tono: "exito" },
  suspendido: { etiqueta: "Suspendido", tono: "error" },
};

export const ESTADO_INSCRIPCION: Record<EstadoInscripcion, Estilo> = {
  activa: { etiqueta: "Activa", tono: "exito" },
  anulada: { etiqueta: "Anulada", tono: "error" },
  transferida: { etiqueta: "Transferida", tono: "info" },
  lista_espera: { etiqueta: "En lista de espera", tono: "aviso" },
};

export const ESTADO_LISTA_ESPERA: Record<EstadoListaEspera, Estilo> = {
  esperando: { etiqueta: "En espera", tono: "neutro" },
  notificado: { etiqueta: "Notificado", tono: "aviso" },
  expirado: { etiqueta: "Expirado", tono: "error" },
  convertido: { etiqueta: "Inscrito", tono: "exito" },
};

export const ROL_EMPRESA: Record<"admin_empresa" | "operador", Estilo> = {
  admin_empresa: { etiqueta: "Administrador", tono: "info" },
  operador: { etiqueta: "Operador", tono: "neutro" },
};
