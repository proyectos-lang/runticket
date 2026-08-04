import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChipEstadoEmpresa } from "@/components/admin/Chips";
import { CrearEmpresaForm } from "./CrearEmpresaForm";

export const dynamic = "force-dynamic";

export default async function EmpresasPage() {
  const supabase = await createClient();
  const { data: empresas } = await supabase
    .from("empresas")
    .select("id, nombre_comercial, slug, estado, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="display text-2xl text-texto">Empresas organizadoras</h1>
        <p className="text-sm text-atenuado">
          Da de alta empresas y su primer administrador.
        </p>
      </div>

      <CrearEmpresaForm />

      <div className="flex flex-col gap-3">
        {empresas?.length ? (
          empresas.map((empresa) => (
            <Link
              key={empresa.id}
              href={`/admin/empresas/${empresa.id}`}
              className="flex items-center justify-between rounded-xl border border-linea bg-superficie px-5 py-4 transition-colors hover:border-linea-fuerte"
            >
              <div>
                <p className="font-medium text-texto">{empresa.nombre_comercial}</p>
                <p className="text-sm text-atenuado">/organizadores/{empresa.slug}</p>
              </div>
              <ChipEstadoEmpresa estado={empresa.estado} />
            </Link>
          ))
        ) : (
          <p className="text-sm text-atenuado">Todavía no hay empresas registradas.</p>
        )}
      </div>
    </div>
  );
}
