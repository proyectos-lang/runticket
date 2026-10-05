import Link from "next/link";
import { cerrarSesion } from "@/lib/auth/actions";
import { Marca } from "@/components/publico/Marca";
import { NavLateral } from "./NavLateral";
import type { SeccionNav } from "./navegacion";
import type { RolEmpresa } from "@/lib/supabase/database.types";

/** Otra área a la que esta persona también puede entrar: portal, panel o consola. */
export type OtraArea = { href: string; etiqueta: string };

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
  otrasAreas = [],
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
  /**
   * Las otras áreas de esta persona. Un organizador que además corre tiene
   * portal y panel, y antes **ninguno enlazaba al otro**: la única forma de
   * pasar de uno a otro era escribir la dirección a mano.
   */
  otrasAreas?: OtraArea[];
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

  const enlacesAreas = otrasAreas.map((a) => (
    <Link
      key={a.href}
      href={a.href}
      className="inline-flex items-center gap-1.5 rounded-lg border border-linea px-3 py-1.5 text-sm text-atenuado transition-colors hover:border-linea-fuerte hover:text-texto"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M17 1l4 4-4 4" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <path d="M7 23l-4-4 4-4" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
      {a.etiqueta}
    </Link>
  ));

  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <NavLateral secciones={secciones} rolEmpresa={rolEmpresa} pie={pieNav}>
        {marca}
      </NavLateral>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden items-center justify-end gap-3 border-b border-linea px-8 py-3 lg:flex">
          {enlacesAreas}
          {correo && <span className="ml-1 text-sm text-mudo">{correo}</span>}
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

        {/* En móvil la cabecera no cabe: las otras áreas y el cierre de sesión van al pie */}
        <footer className="flex flex-wrap items-center gap-3 border-t border-linea px-6 py-4 lg:hidden">
          {enlacesAreas}
          <form action={cerrarSesion} className="ml-auto">
            <button type="submit" className="text-sm text-atenuado">
              Cerrar sesión
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}
