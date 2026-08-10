import { Suspense } from "react";
import { MarcaVertical } from "@/components/publico/MarcaVertical";

/**
 * La marca entra en el armazón estático; el formulario va bajo `<Suspense>`
 * porque estas pantallas leen la sesión y el `?next=` de la URL para decidir a
 * dónde mandar a quien ya está dentro.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-6 py-16">
      <MarcaVertical />
      <Suspense fallback={null}>{children}</Suspense>
    </main>
  );
}
