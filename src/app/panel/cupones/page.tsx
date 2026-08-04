import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { isoAFechaLocal } from "@/lib/format";
import { CabeceraModulo, EstadoVacio } from "@/components/panel/EstadoVacio";
import { GestorCupones, type Cupon } from "./GestorCupones";

export const dynamic = "force-dynamic";

export default async function CuponesPage() {
  const membresia = await getEmpresaActivaDelPanel();
  if (membresia.rol !== "admin_empresa") redirect("/panel");

  const supabase = await createClient();
  const [{ data: cupones }, { data: eventos }] = await Promise.all([
    // La RLS reserva esta lectura al administrador: los códigos no se exponen
    // nunca a los corredores, que solo pueden validarlos escribiéndolos.
    supabase
      .from("cupones")
      .select("*")
      .eq("empresa_id", membresia.empresaId)
      .order("created_at", { ascending: false }),
    supabase
      .from("eventos")
      .select("id, nombre, moneda")
      .eq("empresa_id", membresia.empresaId)
      .order("fecha_inicio", { ascending: false }),
  ]);

  const moneda = eventos?.[0]?.moneda ?? "HNL";

  return (
    <div className="flex flex-col gap-8">
      <CabeceraModulo
        titulo="Cupones de descuento"
        descripcion="Códigos promocionales para tus carreras: porcentaje o monto fijo, con caducidad y tope de usos. El corredor los escribe al inscribirse; nunca se muestran públicamente."
      />

      {cupones?.length || eventos?.length ? (
        <GestorCupones
          moneda={moneda}
          eventos={(eventos ?? []).map((e) => ({ valor: e.id, etiqueta: e.nombre }))}
          cupones={(cupones ?? []).map(
            (c): Cupon => ({
              ...c,
              vigenteDesdeLocal: c.vigente_desde ? isoAFechaLocal(c.vigente_desde) : "",
              vigenteHastaLocal: c.vigente_hasta ? isoAFechaLocal(c.vigente_hasta) : "",
            })
          )}
        />
      ) : (
        <EstadoVacio
          icono="cupones"
          titulo="Todavía no tienes carreras"
          descripcion="Los cupones se aplican sobre el precio de una inscripción, así que primero necesitas al menos una carrera con sus categorías."
          accion={{ href: "/panel/eventos", texto: "Crear mi primera carrera" }}
        />
      )}
    </div>
  );
}
