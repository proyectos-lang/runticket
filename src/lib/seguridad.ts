import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * IP del cliente. Detrás de Vercel viene en x-forwarded-for, que puede traer
 * varias separadas por coma; la primera es la del visitante.
 */
export async function ipDelCliente(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip")?.trim() ??
    null
  );
}

export type Limite = { maximo: number; ventanaSegundos: number };

/** Cuánto se permite en cada formulario abierto a internet. */
export const LIMITES = {
  registro: { maximo: 5, ventanaSegundos: 3600 },
  login: { maximo: 10, ventanaSegundos: 900 },
  recuperarPassword: { maximo: 3, ventanaSegundos: 3600 },
  inscripcion: { maximo: 10, ventanaSegundos: 3600 },
  listaEspera: { maximo: 10, ventanaSegundos: 3600 },
  subidaComprobante: { maximo: 15, ventanaSegundos: 3600 },
  // `validar_cupon` está abierto a visitantes sin sesión: sin freno serviría de
  // oráculo para adivinar códigos promocionales por fuerza bruta.
  cupon: { maximo: 15, ventanaSegundos: 900 },
} satisfies Record<string, Limite>;

export type Accion = keyof typeof LIMITES;

/**
 * Consume un intento. Devuelve `true` si la acción puede continuar.
 *
 * El contador vive en la base de datos, no en memoria: en un despliegue sin
 * servidor cada petición puede caer en una instancia distinta, así que un
 * contador local no limitaría nada.
 *
 * Si la comprobación falla por un problema de infraestructura se **deja pasar**:
 * más vale aceptar tráfico de sobra que dejar a todo el mundo fuera del registro
 * porque una función auxiliar tuvo un mal momento.
 */
export async function dentroDelLimite(accion: Accion, identificador?: string): Promise<boolean> {
  const ip = identificador ?? (await ipDelCliente());
  if (!ip) return true;

  const { maximo, ventanaSegundos } = LIMITES[accion];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consumir_limite", {
    p_clave: `${accion}:${ip}`,
    p_maximo: maximo,
    p_ventana_segundos: ventanaSegundos,
  });

  if (error) {
    console.error("No se pudo comprobar el límite de intentos", accion, error.message);
    return true;
  }
  return data === true;
}

/**
 * Depura un destino de redirección que viene del usuario (`?next=`, campo oculto
 * de un formulario). Devuelve la ruta si es interna, o `null`.
 *
 * Comprobar solo `startsWith("/")` no basta: `//otro-dominio.com` empieza por
 * barra y el navegador lo interpreta como URL absoluta, así que serviría para
 * sacar a alguien del sitio justo después de iniciar sesión. La contrabarra va
 * por lo mismo, porque varios navegadores la normalizan a barra.
 */
export function rutaInternaSegura(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  if (!valor.startsWith("/")) return null;
  if (valor.startsWith("//") || valor.startsWith("/\\")) return null;
  return valor;
}

export const MENSAJE_LIMITE =
  "Demasiados intentos desde esta conexión. Espera unos minutos y vuelve a intentarlo.";

/**
 * Deja constancia de una acción sensible. Nunca hace fallar la operación que la
 * origina: una bitácora caída no debe impedir cobrar ni inscribir.
 */
export async function auditar(args: {
  accion: string;
  entidad: string;
  entidadId?: string | null;
  empresaId?: string | null;
  datosAnteriores?: Record<string, unknown> | null;
  datosNuevos?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("registrar_auditoria", {
      p_accion: args.accion,
      p_entidad: args.entidad,
      p_entidad_id: args.entidadId ?? null,
      p_empresa_id: args.empresaId ?? null,
      p_datos_anteriores: args.datosAnteriores ?? null,
      p_datos_nuevos: args.datosNuevos ?? null,
      p_ip: await ipDelCliente(),
    });
  } catch (e) {
    console.error("No se pudo registrar en la bitácora", args.accion, e);
  }
}
