import { createClient } from "@/lib/supabase/server";
import { trayectoriaDelCorredor, type ClaseCarrera } from "@/lib/portal/trayectoria";
import { FilaInscripcion, EncabezadoSeccion } from "@/components/portal/Historial";
import { PildoraEnlace } from "@/components/ui/Pildora";
import { BotonEnlace } from "@/components/ui/Boton";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PESTANAS: { clave: ClaseCarrera; etiqueta: string }[] = [
  { clave: "proxima", etiqueta: "Próximas" },
  { clave: "finalizada", etiqueta: "Finalizadas" },
  { clave: "cancelada", etiqueta: "Canceladas" },
];

const VACIO: Record<ClaseCarrera, string> = {
  proxima: "No tienes inscripciones pendientes.",
  finalizada: "Todavía no has corrido ninguna carrera.",
  cancelada: "No tienes inscripciones canceladas.",
};

export default async function MisInscripcionesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const t = await trayectoriaDelCorredor(user.id);

  // Se acepta el plural que usa el enlace del historial y el singular interno.
  const activa: ClaseCarrera =
    estado === "finalizadas" || estado === "finalizada"
      ? "finalizada"
      : estado === "canceladas" || estado === "cancelada"
        ? "cancelada"
        : "proxima";

  const grupos: Record<ClaseCarrera, typeof t.carreras> = {
    proxima: t.proximas,
    finalizada: t.finalizadas,
    cancelada: t.canceladas,
  };
  const lista = grupos[activa];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/portal"
          className="font-mono text-xs uppercase tracking-etiqueta text-mudo transition-colors hover:text-texto"
        >
          ← Mi perfil
        </Link>
        <h1 className="display text-2xl text-texto">Mis inscripciones</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {PESTANAS.map((p) => (
          <PildoraEnlace
            key={p.clave}
            href={`/portal/inscripciones?estado=${p.clave}`}
            activa={activa === p.clave}
          >
            {p.etiqueta}
            <span className="tabular font-mono text-[0.625rem] opacity-60">
              {grupos[p.clave].length}
            </span>
          </PildoraEnlace>
        ))}
      </div>

      <section className="flex flex-col gap-2.5">
        <EncabezadoSeccion>{PESTANAS.find((p) => p.clave === activa)!.etiqueta}</EncabezadoSeccion>
        {lista.length ? (
          lista.map((c) => <FilaInscripcion key={c.inscripcionId} carrera={c} />)
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-linea-fuerte px-6 py-10 text-center">
            <p className="text-sm text-atenuado">{VACIO[activa]}</p>
            {activa === "proxima" && (
              <BotonEnlace href="/eventos" variante="primaria" tamano="sm">
                Explorar carreras
              </BotonEnlace>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
