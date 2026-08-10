import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getEventoPorSlug } from "@/lib/eventos/consultas";
import { BuscadorFotos } from "./BuscadorFotos";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "Fotos de la carrera | RunTicket",
    description: "Busca tus fotos por número de dorsal.",
    // Sin indexar: la página existe para quien conoce su dorsal, no para que un
    // buscador la recorra.
    robots: { index: false },
    alternates: { canonical: `/eventos/${slug}/fotos` },
  };
}

/**
 * El armazón —titular, explicación y buscador— es igual para toda carrera, así
 * que entra en el HTML estático. Lo único que depende del `slug` es el enlace de
 * vuelta con el nombre, y por eso es lo único que va bajo `<Suspense>`.
 */
export default async function FotosPublicasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Suspense fallback={<span className="text-sm text-mudo">← Volver</span>}>
        <VueltaAlEvento params={params} />
      </Suspense>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-texto">
        Tus fotos
      </h1>
      <p className="mt-1 text-atenuado">
        Escribe tu número de dorsal y te mostramos las fotos en las que apareces.
      </p>

      <div className="mt-8">
        <Suspense fallback={null}>
          <Buscador params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function VueltaAlEvento({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const evento = await getEventoPorSlug(slug);
  if (!evento) notFound();

  return (
    <Link href={`/eventos/${slug}`} className="text-sm text-mudo hover:text-texto">
      ← {evento.nombre}
    </Link>
  );
}

async function Buscador({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BuscadorFotos slug={slug} />;
}
