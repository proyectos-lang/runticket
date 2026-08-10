import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getPerfilActual } from "@/lib/auth/session";
import { AppShell } from "@/components/shell/AppShell";
import { navAdmin } from "@/components/shell/navegacion";
import { createClient } from "@/lib/supabase/server";
import { PlacaAmbito } from "@/components/admin/Chips";
import { Marca } from "@/components/publico/Marca";

/** Dinámico de principio a fin; ver la nota del layout del panel. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ConsolaAutenticada>{children}</ConsolaAutenticada>
    </Suspense>
  );
}

async function ConsolaAutenticada({ children }: { children: React.ReactNode }) {
  const perfil = await getPerfilActual();
  if (!perfil) redirect("/login?next=/admin");
  if (perfil.rol_plataforma !== "super_admin") redirect("/");

  const supabase = await createClient();
  const [{ count: empresas }, { count: usuarios }] = await Promise.all([
    supabase.from("empresas").select("id", { count: "exact", head: true }),
    supabase.from("perfiles").select("id", { count: "exact", head: true }),
  ]);

  return (
    <AppShell
      secciones={navAdmin({ empresas: empresas ?? 0, usuarios: usuarios ?? 0 })}
      titulo="RunTicket"
      encabezado={
        <div className="flex min-w-0 flex-col gap-2">
          <Marca className="text-lg" />
          <PlacaAmbito />
        </div>
      }
      pieNav={
        // Nota permanente, no un placeholder: evita que alguien busque aquí las
        // carreras. Esta consola habilita empresas; las carreras se gestionan
        // dentro del panel de cada una.
        <p className="rounded-lg border border-azul/24 bg-azul/7 px-3.5 py-3 text-[0.6875rem] leading-relaxed text-azul-aviso">
          Esta consola no gestiona carreras. Para eso, entra al panel de una empresa.
        </p>
      }
      correo={perfil.correo ?? undefined}
    >
      {children}
    </AppShell>
  );
}
