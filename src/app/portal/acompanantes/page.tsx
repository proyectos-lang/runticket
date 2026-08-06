import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { edadEnFecha } from "@/lib/format";
import { Aviso } from "@/components/ui/Aviso";
import { GestorAcompanantes, type Acompanante } from "./GestorAcompanantes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mis acompañantes | RunTicket HN",
  robots: { index: false },
};

export default async function AcompanantesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal/acompanantes");

  const { data: relaciones } = await supabase
    .from("acompanantes")
    .select("id, usuario_id, parentesco")
    .eq("titular_id", user.id)
    .order("created_at");

  const ids = (relaciones ?? []).map((r) => r.usuario_id);

  // La RLS de `perfiles` deja al titular leer los suyos (migración 0026), así que
  // no hace falta cliente administrador.
  const [{ data: perfiles }, { data: inscripciones }] = await Promise.all([
    ids.length
      ? supabase
          .from("perfiles")
          .select(
            "id, nombres, apellidos, correo, fecha_nacimiento, sexo, documento_identidad, talla_predeterminada, contacto_emergencia_nombre, contacto_emergencia_telefono"
          )
          .in("id", ids)
      : Promise.resolve({ data: [] as never[] }),
    ids.length
      ? supabase.from("inscripciones").select("corredor_id").in("corredor_id", ids)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const hoy = new Date().toISOString();
  const lista: Acompanante[] = (relaciones ?? []).map((r) => {
    const p = perfiles?.find((x) => x.id === r.usuario_id);
    return {
      id: r.id,
      parentesco: r.parentesco,
      nombres: p?.nombres ?? null,
      apellidos: p?.apellidos ?? null,
      // El correo interno que se genera cuando no hay uno real no se enseña: no
      // es una dirección de nadie y solo confundiría.
      correo: p?.correo?.endsWith("@interno.runticket.hn") ? null : (p?.correo ?? null),
      fechaNacimiento: p?.fecha_nacimiento ?? null,
      sexo: p?.sexo ?? null,
      documentoIdentidad: p?.documento_identidad ?? null,
      talla: p?.talla_predeterminada ?? null,
      contactoEmergenciaNombre: p?.contacto_emergencia_nombre ?? null,
      contactoEmergenciaTelefono: p?.contacto_emergencia_telefono ?? null,
      inscripciones: (inscripciones ?? []).filter((i) => i.corredor_id === r.usuario_id).length,
      edad: p?.fecha_nacimiento ? edadEnFecha(p.fecha_nacimiento, hoy) : null,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-texto">Mis acompañantes</h1>
        <p className="text-sm text-atenuado">
          Las personas que inscribes contigo. Sus datos quedan guardados, así que en la próxima
          carrera solo tienes que marcarlas.
        </p>
      </div>

      <Aviso tono="azul" titulo="No necesitan cuenta">
        Nadie de esta lista recibe correos ni tiene que registrarse: tú gestionas su inscripción,
        su dorsal y su kit. Al inscribirlos firmas su declaración de salud como responsable, y así
        queda registrado.
      </Aviso>

      <GestorAcompanantes acompanantes={lista} />
    </div>
  );
}
