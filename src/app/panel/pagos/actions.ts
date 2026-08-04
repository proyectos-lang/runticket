"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdminEmpresaActivo } from "@/lib/auth/session";
import { auditar } from "@/lib/seguridad";
import type { EstadoPago } from "@/lib/supabase/database.types";

/**
 * Cambia el estado de un pago. Va contra la RPC actualizar_estado_pago, que
 * vuelve a validar el rol en la base de datos, escribe en pagos_historial y
 * dispara la asignación del dorsal cuando el pago queda confirmado.
 */
export async function cambiarEstadoPago(pagoId: string, nuevoEstado: EstadoPago, formData: FormData) {
  const membresia = await requireAdminEmpresaActivo();

  const notas = formData.get("notas");
  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_estado_pago", {
    p_pago_id: pagoId,
    p_nuevo_estado: nuevoEstado,
    p_notas: typeof notas === "string" && notas.trim() ? notas.trim() : null,
  });
  if (error) throw new Error("No se pudo actualizar el pago: " + error.message);

  // Confirmar o rechazar dinero es lo más sensible que hace el panel: queda en
  // la bitácora con quién, cuándo y desde qué IP.
  await auditar({
    accion: `pago.${nuevoEstado}`,
    entidad: "pagos",
    entidadId: pagoId,
    empresaId: membresia.empresaId,
    datosNuevos: { estado: nuevoEstado, notas: typeof notas === "string" ? notas : null },
  });

  revalidatePath("/panel/pagos");
}

export type PagoManualState = {
  status: "idle" | "error" | "registrado";
  message?: string;
};

const pagoManualSchema = z.object({
  inscripcionId: z.uuid("Selecciona una inscripción."),
  metodo: z.enum(["efectivo", "manual"], { message: "Selecciona el método." }),
  monto: z.coerce.number().min(0, "El monto no puede ser negativo."),
  referencia: z.string().trim().max(60).optional().or(z.literal("")),
  notas: z.string().trim().max(300).optional().or(z.literal("")),
});

/**
 * Registra un cobro que ocurrió fuera de la plataforma (efectivo en punto de
 * venta, transferencia ya conciliada a mano). Entra directamente como 'pagado',
 * y el trigger `asignar_dorsal_al_pagar` —creado en la migración 0013— se
 * encarga de asignar el dorsal, venga el cobro de donde venga.
 *
 * La invoca `RegistrarPagoForm` desde /panel/pagos.
 */
export async function registrarPagoManual(
  _prevState: PagoManualState,
  formData: FormData
): Promise<PagoManualState> {
  const membresia = await requireAdminEmpresaActivo();

  const parsed = pagoManualSchema.safeParse({
    inscripcionId: formData.get("inscripcionId"),
    metodo: formData.get("metodo"),
    monto: formData.get("monto"),
    referencia: formData.get("referencia"),
    notas: formData.get("notas"),
  });
  if (!parsed.success) {
    const primero = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { status: "error", message: primero ?? "Revisa los datos." };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: inscripcion } = await supabase
    .from("inscripciones")
    .select("id, empresa_id, moneda")
    .eq("id", d.inscripcionId)
    .maybeSingle();
  if (!inscripcion || inscripcion.empresa_id !== membresia.empresaId) {
    return { status: "error", message: "Esa inscripción no pertenece a tu empresa." };
  }

  const { data: creado, error } = await supabase
    .from("pagos")
    .insert({
      inscripcion_id: d.inscripcionId,
      empresa_id: membresia.empresaId,
      monto: d.monto,
      moneda: inscripcion.moneda,
      metodo: d.metodo,
      referencia_externa: d.referencia || null,
      notas: d.notas || null,
      estado: "pagado",
    })
    .select("id")
    .single();
  if (error) {
    return { status: "error", message: "No se pudo registrar el pago: " + error.message };
  }

  // Dar por cobrado un dinero que nadie puede rastrear en la plataforma es lo
  // más delicado de esta pantalla: queda en la bitácora igual que aprobar o
  // rechazar un comprobante.
  await auditar({
    accion: "pago.registrado_manual",
    entidad: "pagos",
    entidadId: creado?.id ?? null,
    empresaId: membresia.empresaId,
    datosNuevos: {
      inscripcion_id: d.inscripcionId,
      monto: d.monto,
      metodo: d.metodo,
      referencia: d.referencia || null,
    },
  });

  revalidatePath("/panel/pagos");
  return { status: "registrado" };
}

// Aquí vivía `verComprobante(ruta)`. Se ha eliminado porque nadie la llamaba:
// `panel/pagos/page.tsx` firma las URL en línea al pintar la tabla, que además
// es lo correcto —evita un viaje al servidor por cada comprobante que se abre—.
