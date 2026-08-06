import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { categoriasConCupo } from "@/lib/eventos/consultas";
import { obtenerDeclaracionVigente } from "@/lib/declaraciones";
import { perfilCompleto } from "@/lib/validacion/perfil";
import { edadEnFecha } from "@/lib/format";
import type { AcompananteInscribible } from "./AcompanantesInscripcion";
import { InscripcionForm, type CategoriaElegible } from "./InscripcionForm";
import { ListaEsperaForm } from "./ListaEsperaForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Inscripción | RunTicket",
  robots: { index: false },
};

export default async function InscripcionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { slug } = await params;
  const { categoria: categoriaInicial } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/eventos/${slug}/inscripcion`);

  const { data: evento } = await supabase.from("eventos").select("*").eq("slug", slug).maybeSingle();
  if (!evento) notFound();

  const abierto =
    evento.estado === "publicado" &&
    (!evento.fecha_limite_inscripcion || new Date(evento.fecha_limite_inscripcion) > new Date());
  if (!abierto) redirect(`/eventos/${slug}`);

  const { data: perfil } = await supabase.from("perfiles").select("*").eq("id", user.id).single();
  if (!perfil || !perfilCompleto(perfil)) {
    redirect(`/portal/perfil?next=/eventos/${slug}/inscripcion`);
  }

  const { data: yaInscrito } = await supabase
    .from("inscripciones")
    .select("id")
    .eq("evento_id", evento.id)
    .eq("corredor_id", user.id)
    .eq("estado", "activa")
    .maybeSingle();
  if (yaInscrito) redirect(`/portal/inscripciones/${yaInscrito.id}`);

  const [categorias, { data: tallas }, declaracion] = await Promise.all([
    categoriasConCupo(evento.id),
    supabase
      .from("evento_tallas")
      .select("talla, inventario_disponible")
      .eq("evento_id", evento.id)
      .order("talla"),
    obtenerDeclaracionVigente(evento.empresa_id, evento.id),
  ]);

  // La edad se evalúa el día del evento, igual que hace la función SQL.
  const edad = edadEnFecha(perfil.fecha_nacimiento!, evento.fecha_inicio);

  const categoriasElegibles: CategoriaElegible[] = categorias.map((c) => {
    let motivo: string | null = null;
    if (c.cupos_disponibles !== null && c.cupos_disponibles <= 0) motivo = "Cupo agotado";
    else if (c.edad_minima !== null && edad < c.edad_minima)
      motivo = `Solo desde ${c.edad_minima} años (tendrás ${edad})`;
    else if (c.edad_maxima !== null && edad > c.edad_maxima)
      motivo = `Solo hasta ${c.edad_maxima} años (tendrás ${edad})`;
    return { ...c, elegible: motivo === null, motivoNoElegible: motivo };
  });

  const hayElegibles = categoriasElegibles.some((c) => c.elegible);

  /**
   * Acompañantes del corredor, con las categorías que le tocan a cada uno.
   *
   * La elegibilidad se calcula por persona porque cada una corre lo suyo: el
   * hijo de ocho años no puede entrar en la 21K aunque el padre sí. Es el mismo
   * criterio que aplica la función SQL, aquí adelantado para que el formulario
   * no ofrezca lo que la base va a rechazar.
   */
  const { data: relaciones } = await supabase
    .from("acompanantes")
    .select("id, usuario_id, parentesco")
    .eq("titular_id", user.id)
    .order("created_at");

  const idsAcompanantes = (relaciones ?? []).map((r) => r.usuario_id);
  const [{ data: perfilesAcompanantes }, { data: yaInscritos }] = await Promise.all([
    idsAcompanantes.length
      ? supabase
          .from("perfiles")
          .select("id, nombres, apellidos, fecha_nacimiento, talla_predeterminada")
          .in("id", idsAcompanantes)
      : Promise.resolve({ data: [] as never[] }),
    idsAcompanantes.length
      ? supabase
          .from("inscripciones")
          .select("corredor_id")
          .eq("evento_id", evento.id)
          .eq("estado", "activa")
          .in("corredor_id", idsAcompanantes)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const ETIQUETA_PARENTESCO: Record<string, string> = {
    hijo: "Hijo o hija",
    pareja: "Pareja",
    familiar: "Familiar",
    otro: "Acompañante",
  };

  const acompanantes: AcompananteInscribible[] = (relaciones ?? []).map((r) => {
    const p = perfilesAcompanantes?.find((x) => x.id === r.usuario_id);
    const edadSuya = p?.fecha_nacimiento
      ? edadEnFecha(p.fecha_nacimiento, evento.fecha_inicio)
      : null;

    return {
      id: r.id,
      nombre: [p?.nombres, p?.apellidos].filter(Boolean).join(" ") || "Sin nombre",
      parentesco: ETIQUETA_PARENTESCO[r.parentesco] ?? "Acompañante",
      edad: edadSuya,
      tallaSugerida: p?.talla_predeterminada ?? null,
      yaInscrito: (yaInscritos ?? []).some((i) => i.corredor_id === r.usuario_id),
      categorias: categorias.map((c) => {
        let motivo: string | null = null;
        if (edadSuya === null) motivo = "Falta su fecha de nacimiento";
        else if (c.cupos_disponibles !== null && c.cupos_disponibles <= 0) motivo = "Cupo agotado";
        else if (c.edad_minima !== null && edadSuya < c.edad_minima)
          motivo = `Solo desde ${c.edad_minima} años`;
        else if (c.edad_maxima !== null && edadSuya > c.edad_maxima)
          motivo = `Solo hasta ${c.edad_maxima} años`;
        return {
          id: c.id,
          nombre: c.nombre,
          distancia_km: c.distancia_km,
          precio_vigente: Number(c.precio_vigente),
          elegible: motivo === null,
          motivo,
        };
      }),
    };
  });

  // Para no ofrecer apuntarse dos veces a la misma cola.
  const { data: enEspera } = hayElegibles
    ? { data: [] as { categoria_id: string }[] }
    : await supabase
        .from("lista_espera")
        .select("categoria_id")
        .eq("evento_id", evento.id)
        .eq("usuario_id", user.id)
        .in("estado", ["esperando", "notificado"]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={`/eventos/${slug}`}
        className="font-mono text-xs uppercase tracking-etiqueta text-mudo transition-colors hover:text-texto"
      >
        ← Volver al evento
      </Link>

      <h1 className="mt-4 display text-3xl text-texto">Inscripción</h1>
      <p className="mt-1 text-atenuado">{evento.nombre}</p>

      <div className="mt-8">
        {hayElegibles ? (
          <InscripcionForm
            slug={slug}
            categoriaInicial={categoriaInicial}
            categorias={categoriasElegibles}
            tallas={tallas ?? []}
            moneda={evento.moneda}
            declaracion={declaracion}
            esMenor={edad < 18}
            acompanantes={acompanantes}
            perfil={{
              nombres: perfil.nombres ?? "",
              apellidos: perfil.apellidos ?? "",
              correo: perfil.correo ?? user.email ?? "",
              tallaPredeterminada: perfil.talla_predeterminada,
            }}
          />
        ) : (
          <div className="flex flex-col gap-6">
            <p className="rounded-2xl border border-dashed px-6 py-10 text-center border-linea-fuerte text-atenuado">
              No hay categorías disponibles para ti en este evento (por cupo o por rango de edad).
            </p>
            <ListaEsperaForm
              slug={slug}
              categorias={categoriasElegibles}
              yaApuntado={(enEspera ?? []).map((e) => e.categoria_id)}
            />
          </div>
        )}
      </div>
    </main>
  );
}
