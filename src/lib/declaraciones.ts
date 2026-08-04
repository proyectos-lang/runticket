import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const TEXTO_DECLARACION_POR_DEFECTO = `DECLARACIÓN DE SALUD Y DESLINDE DE RESPONSABILIDAD

Declaro bajo mi responsabilidad que me encuentro en buen estado de salud y que no tengo conocimiento de padecer enfermedad cardíaca, respiratoria, metabólica ni ninguna otra condición médica que me impida realizar esfuerzo físico intenso o participar en la actividad deportiva a la que me inscribo.

Manifiesto que he sido informado del recorrido, las condiciones y las exigencias físicas de la prueba, y que participo de forma libre y voluntaria, asumiendo los riesgos inherentes a la práctica deportiva.

Eximo a la empresa organizadora, a sus patrocinadores, colaboradores y voluntarios de cualquier responsabilidad por daños, lesiones o perjuicios que pudiera sufrir durante mi participación, derivados de mi propio estado de salud o de una conducta imprudente por mi parte.

Autorizo a la organización a prestarme la asistencia médica que resulte necesaria en caso de emergencia, y a utilizar mi nombre e imagen captados durante el evento con fines informativos y promocionales de la prueba.

Autorizo asimismo el tratamiento de mis datos personales con fines de gestión de la inscripción y elaboración de estadísticas agregadas del evento.`;

export type DeclaracionVigente = {
  id: string;
  version: number;
  contenido: string;
};

/**
 * Devuelve la declaración que debe firmar el corredor: primero la específica del
 * evento y, si no existe, la general de la empresa. Si el organizador todavía no
 * configuró ninguna, se crea una versión 1 con el texto estándar para no dejar
 * inscripciones sin respaldo legal.
 */
export async function obtenerDeclaracionVigente(
  empresaId: string,
  eventoId: string
): Promise<DeclaracionVigente> {
  const supabase = await createClient();

  const { data: delEvento } = await supabase
    .from("declaraciones_salud")
    .select("id, version, contenido")
    .eq("evento_id", eventoId)
    .lte("vigente_desde", new Date().toISOString())
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (delEvento) return delEvento;

  const { data: deEmpresa } = await supabase
    .from("declaraciones_salud")
    .select("id, version, contenido")
    .eq("empresa_id", empresaId)
    .is("evento_id", null)
    .lte("vigente_desde", new Date().toISOString())
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (deEmpresa) return deEmpresa;

  // El corredor no tiene permiso para escribir en declaraciones_salud (es del
  // organizador), así que la creación por defecto va con el cliente admin.
  const admin = createAdminClient();
  const { data: creada, error } = await admin
    .from("declaraciones_salud")
    .insert({
      empresa_id: empresaId,
      evento_id: null,
      version: 1,
      contenido: TEXTO_DECLARACION_POR_DEFECTO,
    })
    .select("id, version, contenido")
    .single();

  if (creada) return creada;

  // Otra inscripción simultánea pudo crearla entre la lectura y esta inserción:
  // el índice único la rechaza y basta con releerla.
  const { data: existente } = await admin
    .from("declaraciones_salud")
    .select("id, version, contenido")
    .eq("empresa_id", empresaId)
    .is("evento_id", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existente) return existente;

  throw new Error("No se pudo preparar la declaración de salud: " + (error?.message ?? ""));
}
