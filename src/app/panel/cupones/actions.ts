"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdminEmpresaActivo } from "@/lib/auth/session";
import { opcional } from "@/lib/validacion/comun";
import { fechaLocalAIso } from "@/lib/format";
import { auditar } from "@/lib/seguridad";

export type CuponState = {
  status: "idle" | "error" | "guardado";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

const cuponSchema = z
  .object({
    codigo: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, "El código debe tener al menos 3 caracteres.")
      .max(30)
      .regex(/^[A-Z0-9-]+$/, "Usa solo letras, números y guiones."),
    eventoId: opcional(z.uuid()),
    tipoDescuento: z.enum(["porcentaje", "monto_fijo"], { message: "Selecciona el tipo." }),
    valor: z.coerce.number().positive("El descuento debe ser mayor que cero."),
    usosMaximos: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
      z.number().int().positive("Debe ser al menos 1.").optional()
    ),
    vigenteDesde: opcional(z.string()),
    vigenteHasta: opcional(z.string()),
  })
  .refine((d) => d.tipoDescuento !== "porcentaje" || d.valor <= 100, {
    message: "Un descuento porcentual no puede pasar del 100 %.",
    path: ["valor"],
  })
  .refine((d) => !d.vigenteDesde || !d.vigenteHasta || d.vigenteHasta > d.vigenteDesde, {
    message: "La fecha de fin debe ser posterior a la de inicio.",
    path: ["vigenteHasta"],
  });

export async function guardarCupon(
  cuponId: string | null,
  _prevState: CuponState,
  formData: FormData
): Promise<CuponState> {
  const membresia = await requireAdminEmpresaActivo();

  const parsed = cuponSchema.safeParse({
    codigo: formData.get("codigo"),
    eventoId: formData.get("eventoId"),
    tipoDescuento: formData.get("tipoDescuento"),
    valor: formData.get("valor"),
    usosMaximos: formData.get("usosMaximos"),
    vigenteDesde: formData.get("vigenteDesde"),
    vigenteHasta: formData.get("vigenteHasta"),
  });
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const valores = {
    codigo: d.codigo,
    // Sin evento el cupón sirve para todas las carreras de la empresa.
    evento_id: d.eventoId || null,
    tipo_descuento: d.tipoDescuento,
    valor: d.valor,
    usos_maximos: d.usosMaximos ?? null,
    vigente_desde: d.vigenteDesde ? fechaLocalAIso(d.vigenteDesde) : null,
    vigente_hasta: d.vigenteHasta ? fechaLocalAIso(d.vigenteHasta) : null,
  };

  const { error } = cuponId
    ? await supabase.from("cupones").update(valores).eq("id", cuponId)
    : await supabase.from("cupones").insert({ empresa_id: membresia.empresaId, ...valores });

  if (error) {
    const mensaje = error.message.includes("cupones_empresa_id_codigo_key")
      ? "Ya tienes un cupón con ese código."
      : "No se pudo guardar: " + error.message;
    return { status: "error", message: mensaje };
  }

  await auditar({
    accion: cuponId ? "cupon.editar" : "cupon.crear",
    entidad: "cupones",
    entidadId: cuponId,
    empresaId: membresia.empresaId,
    datosNuevos: { codigo: d.codigo, tipo: d.tipoDescuento, valor: d.valor },
  });

  revalidatePath("/panel/cupones");
  return { status: "guardado" };
}

export async function alternarCupon(cuponId: string, activo: boolean) {
  const membresia = await requireAdminEmpresaActivo();

  const supabase = await createClient();
  const { error } = await supabase
    .from("cupones")
    .update({ activo })
    .eq("id", cuponId)
    .eq("empresa_id", membresia.empresaId);
  if (error) throw new Error("No se pudo actualizar: " + error.message);

  revalidatePath("/panel/cupones");
}

export async function eliminarCupon(cuponId: string) {
  const membresia = await requireAdminEmpresaActivo();
  const supabase = await createClient();

  const { data: cupon } = await supabase
    .from("cupones")
    .select("usos_actuales")
    .eq("id", cuponId)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();

  // Un cupón ya usado forma parte del rastro de cómo se cobró cada inscripción:
  // se desactiva, no se borra.
  if ((cupon?.usos_actuales ?? 0) > 0) {
    throw new Error(
      `Este cupón ya se usó ${cupon!.usos_actuales} ${cupon!.usos_actuales === 1 ? "vez" : "veces"}. Desactívalo en vez de borrarlo.`
    );
  }

  const { error } = await supabase
    .from("cupones")
    .delete()
    .eq("id", cuponId)
    .eq("empresa_id", membresia.empresaId);
  if (error) throw new Error("No se pudo eliminar: " + error.message);

  revalidatePath("/panel/cupones");
}
