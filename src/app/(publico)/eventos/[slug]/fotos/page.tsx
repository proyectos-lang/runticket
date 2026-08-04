import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BuscadorFotos } from "./BuscadorFotos";

export const dynamic = "force-dynamic";

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

export default async function FotosPublicasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: evento } = await supabase
    .from("eventos")
    .select("nombre, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (!evento) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href={`/eventos/${slug}`}
        className="text-sm text-mudo hover:text-texto"
      >
        ← {evento.nombre}
      </Link>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-texto">
        Tus fotos
      </h1>
      <p className="mt-1 text-atenuado">
        Escribe tu número de dorsal y te mostramos las fotos en las que apareces.
      </p>

      <div className="mt-8">
        <BuscadorFotos slug={slug} />
      </div>
    </main>
  );
}
