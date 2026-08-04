import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { listarEventosPublicos, separarPorFecha } from "@/lib/eventos/consultas";
import { TarjetaCarrera } from "@/components/publico/TarjetaCarrera";
import { PlacaLogo } from "@/components/ui/Datos";
import { Aviso } from "@/components/ui/Aviso";

export const dynamic = "force-dynamic";

async function cargarEmpresa(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("empresas")
    .select("id, nombre_comercial, slug, logo_url, correo_contacto, telefono_contacto, estado")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const empresa = await cargarEmpresa(slug);
  if (!empresa) return { title: "Organizador no encontrado | RunTicket" };

  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const descripcion = `Carreras y eventos deportivos organizados por ${empresa.nombre_comercial}.`;

  return {
    title: `${empresa.nombre_comercial} | RunTicket`,
    description: descripcion,
    alternates: { canonical: `${sitio}/organizadores/${empresa.slug}` },
    openGraph: {
      title: empresa.nombre_comercial,
      description: descripcion,
      url: `${sitio}/organizadores/${empresa.slug}`,
      siteName: "RunTicket",
      type: "website",
      locale: "es_HN",
      images: empresa.logo_url ? [{ url: empresa.logo_url }] : undefined,
    },
  };
}

export default async function OrganizadorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const empresa = await cargarEmpresa(slug);
  if (!empresa) notFound();

  const eventos = await listarEventosPublicos({ empresaId: empresa.id });
  const { proximos, pasados } = separarPorFecha(eventos);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex flex-col gap-5 border-b border-linea pb-8 sm:flex-row sm:items-center">
        {/* Placa clara obligatoria: un logo de tinta oscura con transparencia
            desaparece sobre el fondo del sistema. */}
        <PlacaLogo className="size-26 shrink-0">
          {empresa.logo_url ? (
            <span className="relative size-full">
              <Image
                src={empresa.logo_url}
                alt={empresa.nombre_comercial}
                fill
                sizes="104px"
                className="object-contain"
              />
            </span>
          ) : (
            <span className="font-mono text-xs font-bold uppercase tracking-etiqueta text-fondo/45">
              {empresa.nombre_comercial.slice(0, 3)}
            </span>
          )}
        </PlacaLogo>

        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="display text-[2.125rem] text-texto">{empresa.nombre_comercial}</h1>
          {(empresa.correo_contacto || empresa.telefono_contacto) && (
            <p className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[0.71875rem] text-atenuado">
              {empresa.correo_contacto && <span>{empresa.correo_contacto}</span>}
              {empresa.telefono_contacto && <span>{empresa.telefono_contacto}</span>}
            </p>
          )}
        </div>
      </header>

      {empresa.estado === "suspendida" && (
        <Aviso tono="ambar" className="mt-6">
          Este organizador está temporalmente suspendido. Sus carreras no admiten inscripciones.
        </Aviso>
      )}

      <section className="py-10">
        <h2 className="mb-4 font-mono text-[0.6875rem] font-semibold uppercase tracking-etiqueta text-mudo">
          Próximas carreras
        </h2>
        {proximos.length ? (
          <div className="grid gap-3.5 sm:grid-cols-2">
            {proximos.map((evento, i) => (
              <TarjetaCarrera key={evento.id} evento={evento} compacta destacada={i === 0} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed px-6 py-10 text-center border-linea-fuerte text-atenuado">
            Este organizador no tiene carreras próximas publicadas.
          </p>
        )}
      </section>

      {pasados.length > 0 && (
        <section className="border-t py-10 border-linea">
          <h2 className="mb-6 text-xl font-semibold tracking-tight text-texto">
            Ediciones anteriores
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pasados.slice(0, 6).map((evento) => (
              <TarjetaCarrera key={evento.id} evento={evento} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
