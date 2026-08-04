import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { categoriasConCupo, puntosDeEntrega } from "@/lib/eventos/consultas";
import { formatFechaMono, formatHoraMono, diasHasta } from "@/lib/format";
import { enlaceGoogleCalendar, enlaceOutlook } from "@/lib/calendario";
import { sanearHtml, textoPlano } from "@/lib/sanitizar";
import { DISCIPLINA_LABEL } from "@/lib/disciplinas";
import { CuentaRegresiva } from "@/components/publico/CuentaRegresiva";
import { MapaEvento } from "@/components/publico/MapaEvento";
import { SelectorDistancia } from "@/components/publico/SelectorDistancia";
import { Chip } from "@/components/ui/Chip";
import { EtiquetaMono, PlaceholderMedia, PlacaLogo } from "@/components/ui/Datos";
import type { Disciplina } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

async function cargarEvento(slug: string) {
  const supabase = await createClient();
  const { data: evento } = await supabase.from("eventos").select("*").eq("slug", slug).maybeSingle();
  if (!evento) return null;

  const [{ data: empresa }, { data: imagenes }, { data: patrocinadores }, { data: tallas }] =
    await Promise.all([
      supabase
        .from("empresas")
        .select("id, nombre_comercial, slug, logo_url, correo_contacto, telefono_contacto")
        .eq("id", evento.empresa_id)
        .maybeSingle(),
      supabase.from("evento_imagenes").select("id, url, orden").eq("evento_id", evento.id).order("orden"),
      supabase
        .from("patrocinadores")
        .select("id, nombre, logo_url, url_sitio, orden")
        .eq("evento_id", evento.id)
        .order("orden"),
      supabase.from("evento_tallas").select("talla, inventario_disponible").eq("evento_id", evento.id),
    ]);

  return { evento, empresa, imagenes: imagenes ?? [], patrocinadores: patrocinadores ?? [], tallas: tallas ?? [] };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const datos = await cargarEvento(slug);
  if (!datos) return { title: "Carrera no encontrada | RunTicket" };

  const { evento, empresa } = datos;
  // `||` y no `??`: textoPlano devuelve cadena vacía, no null, cuando no hay
  // descripción, y con `??` nunca se usaría el texto alternativo.
  const resumen =
    textoPlano(evento.descripcion, 200) ||
    `${evento.nombre} — organizado por ${empresa?.nombre_comercial ?? "RunTicket"}.`;
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const url = `${sitio}/eventos/${evento.slug}`;

  return {
    title: `${evento.nombre} | RunTicket`,
    description: resumen,
    alternates: { canonical: url },
    openGraph: {
      title: evento.nombre,
      description: resumen,
      url,
      siteName: "RunTicket",
      type: "website",
      locale: "es_HN",
      images: evento.imagen_banner_url ? [{ url: evento.imagen_banner_url }] : undefined,
    },
    twitter: {
      card: evento.imagen_banner_url ? "summary_large_image" : "summary",
      title: evento.nombre,
      description: resumen,
      images: evento.imagen_banner_url ? [evento.imagen_banner_url] : undefined,
    },
  };
}

/** Celda de la tira de datos bajo el titular. */
function Celda({
  etiqueta,
  valor,
  destacado = false,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  destacado?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1 px-5 py-4 first:pl-5">
      <EtiquetaMono>{etiqueta}</EtiquetaMono>
      <span
        className={`tabular font-mono text-sm font-bold ${destacado ? "text-cian" : "text-texto"}`}
      >
        {valor}
      </span>
    </div>
  );
}

export default async function EventoDetallePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const datos = await cargarEvento(slug);
  if (!datos) notFound();

  const { evento, empresa, imagenes, patrocinadores, tallas } = datos;
  const [categorias, entregas] = await Promise.all([
    categoriasConCupo(evento.id),
    puntosDeEntrega(evento.id),
  ]);
  const descripcionSegura = sanearHtml(evento.descripcion);

  const abierto =
    evento.estado === "publicado" &&
    (!evento.fecha_limite_inscripcion || new Date(evento.fecha_limite_inscripcion) > new Date());

  const conTope = categorias.filter((c) => c.cupo_maximo !== null);
  const cuposLibres = conTope.length
    ? conTope.reduce((a, c) => a + (c.cupos_disponibles ?? 0), 0)
    : null;
  // Se comprueba el tipo y no `!== null`: los tipos de las funciones RPC se
  // mantienen a mano, así que una columna que la función todavía no devuelve
  // llega como `undefined` y pasaría el filtro de null.
  const desnivelMax = categorias.reduce<number | null>(
    (a, c) => (typeof c.desnivel_m === "number" && (a === null || c.desnivel_m > a) ? c.desnivel_m : a),
    null
  );

  const diasParaCerrar = evento.fecha_limite_inscripcion
    ? diasHasta(evento.fecha_limite_inscripcion)
    : null;

  const datosCalendario = {
    titulo: evento.nombre,
    descripcion: textoPlano(evento.descripcion, 500),
    ubicacion: evento.direccion,
    inicio: evento.fecha_inicio,
  };

  return (
    <main>
      {/* El degradado inferior funde la foto con el fondo; sin él, el corte
          recto de la imagen parte la pantalla en dos. */}
      <div className="relative h-70 w-full sm:h-90">
        {evento.imagen_banner_url ? (
          <Image
            src={evento.imagen_banner_url}
            alt={evento.nombre}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <PlaceholderMedia
            etiqueta="foto: pelotón de salida"
            variante="calida"
            className="absolute inset-0"
          />
        )}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-28"
          style={{ background: "linear-gradient(to bottom, transparent, var(--color-fondo))" }}
        />
      </div>

      <div className="relative -mt-9 px-6 pb-16 lg:px-10">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_20rem]">
          <div className="flex min-w-0 flex-col gap-8">
            <header className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-azul/42 bg-azul/16 px-2.5 py-1 font-mono text-[0.59375rem] font-bold uppercase tracking-etiqueta text-azul-texto">
                  {DISCIPLINA_LABEL[evento.disciplina as Disciplina]}
                </span>
                {!abierto && (
                  <Chip tono="neutro">
                    {evento.estado === "finalizado"
                      ? "Finalizado"
                      : evento.estado === "cancelado"
                        ? "Cancelado"
                        : "Inscripciones cerradas"}
                  </Chip>
                )}
              </div>

              <h1 className="display text-[clamp(2rem,7vw,3rem)] text-texto">{evento.nombre}</h1>

              {evento.direccion && <p className="text-atenuado">{evento.direccion}</p>}

              <div className="flex flex-wrap divide-x divide-linea rounded-2xl border border-linea bg-superficie">
                <Celda
                  etiqueta="Fecha"
                  valor={`${formatFechaMono(evento.fecha_inicio, evento.zona_horaria)} · ${formatHoraMono(evento.fecha_inicio, evento.zona_horaria)}`}
                />
                <Celda
                  etiqueta="Desnivel"
                  destacado
                  valor={desnivelMax !== null ? `+${desnivelMax.toLocaleString("es-HN")} m` : "Llano"}
                />
                <Celda
                  etiqueta="Cupos"
                  valor={cuposLibres === null ? "Abiertos" : `${cuposLibres} libres`}
                />
              </div>

              {empresa && (
                <p className="text-sm text-atenuado">
                  Organiza{" "}
                  <Link
                    href={`/organizadores/${empresa.slug}`}
                    className="font-medium text-texto underline-offset-2 hover:underline"
                  >
                    {empresa.nombre_comercial}
                  </Link>
                </p>
              )}

              <CuentaRegresiva fecha={evento.fecha_inicio} />
            </header>

            <SelectorDistancia
              slug={evento.slug}
              categorias={categorias}
              moneda={evento.moneda}
              abierto={abierto}
            />

            {evento.lat !== null && evento.lng !== null && (
              <section className="flex flex-col gap-3">
                <EtiquetaMono>Ruta y punto de encuentro</EtiquetaMono>
                <MapaEvento
                  lat={Number(evento.lat)}
                  lng={Number(evento.lng)}
                  titulo={evento.nombre}
                  puntoEncuentro={
                    evento.punto_encuentro_lat !== null && evento.punto_encuentro_lng !== null
                      ? { lat: Number(evento.punto_encuentro_lat), lng: Number(evento.punto_encuentro_lng) }
                      : null
                  }
                  rutaGpxUrl={evento.ruta_gpx_url}
                />
              </section>
            )}

            {descripcionSegura && (
              // Se sanea también al pintar, no solo al guardar: ya hay
              // descripciones almacenadas antes de que existiera el saneado.
              <section
                className="prosa max-w-none"
                dangerouslySetInnerHTML={{ __html: descripcionSegura }}
              />
            )}

            {evento.kit_contenido.length > 0 && (
              <section className="flex flex-col gap-3">
                <EtiquetaMono>Tu inscripción incluye</EtiquetaMono>
                <ol className="grid gap-2.5 sm:grid-cols-2">
                  {evento.kit_contenido.map((item: string, i: number) => (
                    <li
                      key={item}
                      className="flex items-center gap-3 rounded-xl border border-linea bg-superficie px-4 py-3 text-sm text-texto"
                    >
                      <span className="tabular font-mono text-sm font-bold text-naranja">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {item}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {entregas.length > 0 && (
              <section className="flex flex-col gap-3">
                <EtiquetaMono>Dónde y cuándo recoger el kit</EtiquetaMono>
                <div className="flex flex-col gap-2">
                  {entregas.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-linea bg-superficie px-4 py-3.5"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-texto">{p.nombre}</p>
                        {p.direccion && <p className="text-sm text-atenuado">{p.direccion}</p>}
                        {p.horario && (
                          <Chip tono="info" className="mt-1.5">
                            {p.horario}
                          </Chip>
                        )}
                      </div>
                      {p.lat !== null && p.lng !== null && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs uppercase tracking-etiqueta text-cian underline underline-offset-2 hover:text-texto"
                        >
                          Abrir en mapas →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="grid gap-8 sm:grid-cols-2">
            {tallas.length > 0 && (
              <section className="flex flex-col gap-3">
                <EtiquetaMono>Tallas disponibles</EtiquetaMono>
                <div className="flex flex-wrap gap-2">
                  {tallas.map((t) => {
                    const sinStock = t.inventario_disponible !== null && t.inventario_disponible <= 0;
                    return (
                      <span
                        key={t.talla}
                        className={`rounded-full border px-3 py-1 text-sm ${
                          sinStock
                            ? "border-linea text-mudo line-through"
                            : "border-linea-fuerte text-atenuado"
                        }`}
                      >
                        {t.talla}
                      </span>
                    );
                  })}
                </div>
              </section>
            )}

            {imagenes.length > 0 && (
              <section className="flex flex-col gap-3">
                <EtiquetaMono>Galería</EtiquetaMono>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {imagenes.map((img) => (
                    <div key={img.id} className="relative h-24 overflow-hidden rounded-lg">
                      <Image src={img.url} alt="" fill sizes="33vw" className="object-cover" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {patrocinadores.length > 0 && (
              <section className="flex flex-col gap-3">
                <EtiquetaMono>Patrocinadores</EtiquetaMono>
                <div className="flex flex-wrap items-center gap-3">
                  {patrocinadores.map((p) => {
                    // Placa clara obligatoria bajo el logo: uno de tinta oscura
                    // con transparencia desaparecería sobre el fondo del sistema.
                    const contenido = p.logo_url ? (
                      <PlacaLogo className="h-16 w-32">
                        <span className="relative h-full w-full">
                          <Image
                            src={p.logo_url}
                            alt={p.nombre}
                            fill
                            sizes="128px"
                            className="object-contain"
                          />
                        </span>
                      </PlacaLogo>
                    ) : (
                      // Sin logo, el nombre ocupa el mismo hueco que ocuparía la
                      // placa: así la fila no se descuadra al mezclar ambos.
                      <span className="flex h-16 w-32 items-center justify-center rounded-lg border border-linea-fuerte px-3 text-center text-sm font-medium text-texto">
                        {p.nombre}
                      </span>
                    );

                    // Sin sitio web no se envuelve en un enlace: un `href="#"`
                    // es un enlace muerto que además recibe el foco del teclado.
                    return p.url_sitio ? (
                      <a
                        key={p.id}
                        href={p.url_sitio}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        aria-label={`${p.nombre} (abre en una pestaña nueva)`}
                        className="rounded-lg transition-opacity hover:opacity-80"
                      >
                        {contenido}
                      </a>
                    ) : (
                      <span key={p.id}>{contenido}</span>
                    );
                  })}
                </div>
              </section>
            )}
            </div>
          </div>

          {/* Tres tarjetas independientes, no un panel único: cada una es un
              dato distinto y en móvil bajan al final del contenido. */}
          <aside className="flex h-fit flex-col gap-3 lg:sticky lg:top-24 lg:pt-10">
            {abierto ? (
              evento.fecha_limite_inscripcion && (
                <div className="flex flex-col gap-1.5 rounded-xl border border-naranja/28 bg-superficie-2 px-5 py-4">
                  <EtiquetaMono>Cierre de inscripciones</EtiquetaMono>
                  <span className="tabular font-mono text-base font-bold text-texto">
                    {formatFechaMono(evento.fecha_limite_inscripcion, evento.zona_horaria)} ·{" "}
                    {formatHoraMono(evento.fecha_limite_inscripcion, evento.zona_horaria)}
                  </span>
                  {diasParaCerrar !== null && diasParaCerrar >= 0 && (
                    <span className="text-sm text-naranja-suave">
                      {diasParaCerrar === 0
                        ? "Cierra hoy"
                        : diasParaCerrar === 1
                          ? "Falta 1 día"
                          : `Faltan ${diasParaCerrar} días`}
                    </span>
                  )}
                </div>
              )
            ) : (
              <div className="rounded-xl border border-linea bg-superficie-2 px-5 py-4 text-center text-sm text-atenuado">
                {evento.estado === "finalizado"
                  ? "Este evento ya se celebró."
                  : evento.estado === "cancelado"
                    ? "Este evento fue cancelado."
                    : evento.fecha_limite_inscripcion
                      ? `Las inscripciones cerraron el ${formatFechaMono(evento.fecha_limite_inscripcion, evento.zona_horaria)}.`
                      : "Las inscripciones están cerradas."}
              </div>
            )}

            {/*
              Clasificación y galería solo existían como enlace desde el portal, es
              decir, únicamente para quien ya estaba inscrito y con resultado
              publicado. Un visitante no tenía forma de llegar a ellas: aquí es
              donde las busca cualquiera que oiga hablar de la carrera después de
              celebrada.
            */}
            {evento.estado === "finalizado" && (
              <div className="flex flex-col gap-2.5 rounded-xl border border-linea bg-superficie px-5 py-4">
                <EtiquetaMono>Después de la carrera</EtiquetaMono>
                <div className="flex flex-col gap-2">
                  <Link
                    href={`/eventos/${evento.slug}/resultados`}
                    className="flex h-10 items-center justify-center rounded-md border border-linea-fuerte text-[0.78125rem] font-medium text-texto transition-colors hover:border-texto/25"
                  >
                    Ver clasificación
                  </Link>
                  <Link
                    href={`/eventos/${evento.slug}/fotos`}
                    className="flex h-10 items-center justify-center rounded-md border border-linea-fuerte text-[0.78125rem] font-medium text-texto transition-colors hover:border-texto/25"
                  >
                    Buscar mis fotos
                  </Link>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2.5 rounded-xl border border-linea bg-superficie px-5 py-4">
              <EtiquetaMono>Agregar a mi calendario</EtiquetaMono>
              <div className="flex flex-col gap-2">
                {[
                  { texto: "Google Calendar", href: enlaceGoogleCalendar(datosCalendario), externo: true },
                  { texto: "Outlook", href: enlaceOutlook(datosCalendario), externo: true },
                  { texto: "Descargar .ics", href: `/eventos/${evento.slug}/calendario.ics`, externo: false },
                ].map((c) => (
                  <a
                    key={c.texto}
                    href={c.href}
                    {...(c.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="flex h-10 items-center justify-center rounded-md border border-linea-fuerte text-[0.78125rem] font-medium text-texto transition-colors hover:border-texto/25"
                  >
                    {c.texto}
                  </a>
                ))}
              </div>
            </div>

            {empresa && (empresa.correo_contacto || empresa.telefono_contacto) && (
              <div className="flex flex-col gap-2 rounded-xl border border-linea bg-superficie px-5 py-4">
                <EtiquetaMono>Contacto del organizador</EtiquetaMono>
                <p className="text-sm font-bold text-texto">{empresa.nombre_comercial}</p>
                <div className="flex flex-col gap-0.5 font-mono text-[0.71875rem] leading-relaxed text-atenuado">
                  {empresa.correo_contacto && <span>{empresa.correo_contacto}</span>}
                  {empresa.telefono_contacto && <span>{empresa.telefono_contacto}</span>}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
