import Link from "next/link";
import { cerrarSesion } from "@/lib/auth/actions";
import { Marca } from "@/components/publico/Marca";
import { NavLateral } from "./NavLateral";
import type { SeccionNav } from "./navegacion";
import type { RolEmpresa } from "@/lib/supabase/database.types";

/**
 * Maquetación común de las tres áreas autenticadas. Es deliberadamente tonta:
 * recibe la navegación ya construida (JSON serializable) para que cada layout
 * conserve su propia guarda de rol y decida qué mostrar.
 */
export function AppShell({
  secciones,
  titulo,
  subtitulo,
  correo,
  rolEmpresa,
  encabezado,
  pieNav,
  children,
}: {
  secciones: SeccionNav[];
  /** Identidad del área o de la empresa activa. */
  titulo: string;
  subtitulo?: string;
  correo?: string;
  /** Presente solo en el panel: habilita la sub-navegación del evento abierto. */
  rolEmpresa?: RolEmpresa;
  /** Sustituye al bloque de marca; se usa para el selector de empresa. */
  encabezado?: React.ReactNode;
  /** Bloque fijo al pie de la navegación lateral. */
  pieNav?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Cuando el título es la marca se pinta el wordmark del sistema, no el texto
  // suelto: es la misma pieza que ve el corredor en la web pública y no debe
  // divergir. En el panel el título es el nombre de la empresa, y ahí sí es texto.
  const marca =
    encabezado ??
    (titulo === "RunTicket" ? (
      <div className="flex min-w-0 flex-col gap-1">
        <Marca className="text-lg" />
        {subtitulo && (
          <p className="truncate font-mono text-[0.625rem] font-medium uppercase tracking-[0.14em] text-mudo">
            {subtitulo}
          </p>
        )}
      </div>
    ) : (
      <Link href="/" className="block min-w-0">
        <p className="truncate font-semibold tracking-display text-texto">{titulo}</p>
        {subtitulo && <p className="truncate text-xs text-mudo">{subtitulo}</p>}
      </Link>
    ));

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <NavLateral secciones={secciones} rolEmpresa={rolEmpresa} pie={pieNav}>
        {marca}
      </NavLateral>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden items-center justify-end gap-4 border-b border-linea px-8 py-3 lg:flex">
          {correo && <span className="text-sm text-mudo">{correo}</span>}
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm text-atenuado transition-colors hover:bg-superficie-2 hover:text-texto"
            >
              Cerrar sesión
            </button>
          </form>
        </header>

        <main className="flex-1 px-6 py-8 lg:px-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>

        {/* En móvil la cabecera no cabe: el cierre de sesión va al pie */}
        <footer className="border-t border-linea px-6 py-4 lg:hidden">
          <form action={cerrarSesion}>
            <button type="submit" className="text-sm text-atenuado">
              Cerrar sesión
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}
