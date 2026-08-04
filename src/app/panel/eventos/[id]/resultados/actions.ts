"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdminDeEvento } from "@/lib/auth/session";

export type ResultadosState = {
  status: "idle" | "error" | "cargado";
  message?: string;
  resumen?: { procesados: number; errores: string[] };
};

/**
 * Acepta "01:23:45", "1:23:45", "83:45" (mm:ss) o segundos sueltos y lo
 * normaliza al formato que Postgres interpreta como interval.
 */
function normalizarTiempo(valor: string): string | null {
  const limpio = valor.trim().replace(",", ".");
  if (!limpio) return null;

  if (/^\d+(\.\d+)?$/.test(limpio)) {
    const total = Math.round(Number(limpio));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  const partes = limpio.split(":");
  if (partes.length === 2) return `0:${partes[0].padStart(2, "0")}:${partes[1].padStart(2, "0")}`;
  if (partes.length === 3) return `${partes[0]}:${partes[1].padStart(2, "0")}:${partes[2].padStart(2, "0")}`;
  return null;
}

/** Divide una línea CSV respetando comillas. */
function partirLinea(linea: string): string[] {
  const celdas: string[] = [];
  let actual = "";
  let enComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (enComillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else enComillas = !enComillas;
    } else if ((c === "," || c === ";") && !enComillas) {
      celdas.push(actual);
      actual = "";
    } else actual += c;
  }
  celdas.push(actual);
  return celdas.map((c) => c.trim());
}

export async function cargarResultadosCsv(
  eventoId: string,
  _prevState: ResultadosState,
  formData: FormData
): Promise<ResultadosState> {
  await requireAdminDeEvento(eventoId);

  const archivo = formData.get("csv");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { status: "error", message: "Selecciona el archivo CSV del cronometraje." };
  }
  if (archivo.size > 2 * 1024 * 1024) {
    return { status: "error", message: "El archivo supera los 2 MB." };
  }

  const texto = (await archivo.text()).replace(/^﻿/, "");
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) return { status: "error", message: "El archivo está vacío." };

  // Se salta la cabecera si la primera celda no es un número (es decir, no es un dorsal).
  const primera = partirLinea(lineas[0]);
  const filas = /^\d+$/.test(primera[0]) ? lineas : lineas.slice(1);

  const supabase = await createClient();
  const errores: string[] = [];
  let procesados = 0;

  for (const [indice, linea] of filas.entries()) {
    const celdas = partirLinea(linea);
    const dorsal = Number(celdas[0]);
    const tiempo = normalizarTiempo(celdas[1] ?? "");

    if (!Number.isInteger(dorsal) || dorsal <= 0) {
      errores.push(`Línea ${indice + 1}: dorsal no válido ("${celdas[0]}")`);
      continue;
    }
    if (!tiempo) {
      errores.push(`Línea ${indice + 1}: tiempo no válido ("${celdas[1] ?? ""}")`);
      continue;
    }

    const { error } = await supabase.rpc("registrar_resultado", {
      p_evento_id: eventoId,
      p_dorsal: dorsal,
      p_tiempo: tiempo,
    });
    if (error) errores.push(`Dorsal ${dorsal}: ${error.message.replace(/^.*?:\s*/, "")}`);
    else procesados++;
  }

  if (procesados > 0) {
    // Con los tiempos ya cargados, las posiciones se derivan solas.
    await supabase.rpc("recalcular_posiciones", { p_evento_id: eventoId });
  }

  revalidatePath(`/panel/eventos/${eventoId}/resultados`);
  return {
    status: procesados > 0 ? "cargado" : "error",
    message: procesados === 0 ? "No se pudo cargar ningún resultado." : undefined,
    resumen: { procesados, errores: errores.slice(0, 20) },
  };
}

export async function publicarResultados(eventoId: string, publicar: boolean) {
  await requireAdminDeEvento(eventoId);
  const supabase = await createClient();

  const { data: inscripciones } = await supabase
    .from("inscripciones")
    .select("id")
    .eq("evento_id", eventoId);
  const ids = (inscripciones ?? []).map((i) => i.id);
  if (!ids.length) return;

  const { error } = await supabase
    .from("resultados")
    .update({ publicado: publicar })
    .in("inscripcion_id", ids);
  if (error) throw new Error("No se pudieron publicar los resultados: " + error.message);

  revalidatePath(`/panel/eventos/${eventoId}/resultados`);
}

export async function recalcularPosiciones(eventoId: string) {
  await requireAdminDeEvento(eventoId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("recalcular_posiciones", { p_evento_id: eventoId });
  if (error) throw new Error("No se pudieron recalcular las posiciones: " + error.message);
  revalidatePath(`/panel/eventos/${eventoId}/resultados`);
}
