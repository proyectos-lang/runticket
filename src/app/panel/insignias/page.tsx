import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { CabeceraModulo, EstadoVacio } from "@/components/panel/EstadoVacio";
import { GestorInsignias, type Insignia } from "./GestorInsignias";
import type { CriterioInsignia } from "@/lib/supabase/database.types";

export default async function InsigniasPage() {
  const membresia = await getEmpresaActivaDelPanel();
  if (membresia.rol !== "admin_empresa") redirect("/panel");

  const supabase = await createClient();
  const [{ data: insignias }, { data: eventos }] = await Promise.all([
    supabase
      .from("insignias")
      .select("id, codigo, nombre, descripcion, icono_url, criterio, activa, created_at")
      .eq("empresa_id", membresia.empresaId)
      .order("created_at", { ascending: false }),
    supabase
      .from("eventos")
      .select("id, nombre, estado")
      .eq("empresa_id", membresia.empresaId)
      .order("fecha_inicio", { ascending: false }),
  ]);

  // Cuántos corredores tiene cada una: decide si se puede borrar o solo
  // desactivar. Una sola consulta agregada en memoria, que el catálogo de una
  // empresa son unas pocas insignias.
  const ids = (insignias ?? []).map((i) => i.id);
  const { data: concedidas } = ids.length
    ? await supabase.from("usuario_insignias").select("insignia_id").in("insignia_id", ids)
    : { data: [] as { insignia_id: string }[] };

  const cuenta = new Map<string, number>();
  for (const c of concedidas ?? []) {
    cuenta.set(c.insignia_id, (cuenta.get(c.insignia_id) ?? 0) + 1);
  }

  const filas: Insignia[] = (insignias ?? []).map((i) => ({
    ...i,
    criterio: i.criterio as CriterioInsignia,
    concedidas: cuenta.get(i.id) ?? 0,
  }));

  const finalizados = (eventos ?? []).filter((e) => e.estado === "finalizado");

  return (
    <div className="flex flex-col gap-8">
      <CabeceraModulo
        titulo="Insignias"
        descripcion="Reconocimientos que tus corredores acumulan carrera tras carrera y ven en su perfil. Se conceden solas al marcar una carrera como finalizada, según el criterio que definas. Cuentan únicamente carreras tuyas: lo que un corredor haya hecho con otro organizador no suma aquí."
      />

      {eventos?.length ? (
        <GestorInsignias
          insignias={filas}
          eventosFinalizados={finalizados.map((e) => ({ id: e.id, nombre: e.nombre }))}
        />
      ) : (
        <EstadoVacio
          icono="resultados"
          titulo="Todavía no tienes carreras"
          descripcion="Una insignia se gana corriendo, así que primero necesitas al menos una carrera. Después podrás premiar a quien complete tres, acumule 100 km o vuelva tres años seguidos."
          accion={{ href: "/panel/eventos", texto: "Crear mi primera carrera" }}
        />
      )}
    </div>
  );
}
