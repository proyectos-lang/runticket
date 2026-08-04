import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PerfilForm } from "./PerfilForm";

export const dynamic = "force-dynamic";

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal/perfil");

  const [{ data: perfil }, { data: paises }] = await Promise.all([
    supabase.from("perfiles").select("*").eq("id", user.id).single(),
    supabase.from("paises").select("id, nombre").order("nombre"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-texto">Mi perfil</h1>
        <p className="text-sm text-atenuado">
          Estos datos se precargan en cada inscripción; solo los completas una vez.
        </p>
      </div>
      <PerfilForm perfil={perfil!} paises={paises ?? []} next={next} />
    </div>
  );
}
