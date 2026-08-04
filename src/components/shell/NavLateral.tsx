"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icono } from "./iconos";
import { eventoDeRuta, navEvento, type SeccionNav } from "./navegacion";
import { contextoDeCarrera, type ContextoCarrera } from "./contextoCarrera";
import type { RolEmpresa } from "@/lib/supabase/database.types";

function estaActivo(pathname: string, href: string, exacto?: boolean) {
  return exacto ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

export function NavLateral({
  secciones,
  /** Solo en el panel: permite añadir la sub-navegación del evento abierto. */
  rolEmpresa,
  pie,
  children,
}: {
  secciones: SeccionNav[];
  rolEmpresa?: RolEmpresa;
  /** Bloque fijo bajo la navegación: notas de alcance, avisos permanentes. */
  pie?: React.ReactNode;
  /** Cabecera del sidebar (marca, selector de empresa) renderizada en el servidor. */
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  const eventoId = rolEmpresa ? eventoDeRuta(pathname) : null;

  // Nombre y pendientes de la carrera abierta. Se guardan junto a su id y el
  // valor en uso se **deriva** comparándolo con la ruta actual: así, al pasar a
  // otra carrera, el menú deja de usar el contexto anterior sin necesidad de
  // limpiarlo desde el efecto, que provocaría un render en cascada.
  const [cache, setCache] = useState<{ id: string; datos: ContextoCarrera } | null>(null);
  const contexto = cache && cache.id === eventoId ? cache.datos : null;

  useEffect(() => {
    if (!eventoId) return;
    let vigente = true;
    void contextoDeCarrera(eventoId).then((c) => {
      if (vigente && c) setCache({ id: eventoId, datos: c });
    });
    return () => {
      vigente = false;
    };
  }, [eventoId]);
  const todas: SeccionNav[] = eventoId
    ? [
        ...secciones,
        navEvento(eventoId, rolEmpresa!, contexto ?? undefined),
        { items: [{ href: "/panel/eventos", etiqueta: "Todos los eventos", icono: "volver", exacto: true }] },
      ]
    : secciones;

  const contenido = (
    // `min-h-0` es imprescindible: sin él, en un contenedor flex en columna este
    // hijo no puede encoger por debajo de su contenido, así que crece, el scroll
    // nunca aparece y los últimos módulos quedan fuera de la pantalla.
    <nav className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-3 py-4">
      {todas.map((seccion, i) => (
        <div key={seccion.titulo ?? i} className="flex flex-col gap-1">
          {seccion.titulo && (
            <div className="flex flex-col gap-0.5 px-3.5 pb-2 pt-3">
              <p
                className={`font-mono text-[0.625rem] font-bold uppercase tracking-[0.16em] ${
                  seccion.contextual ? "text-naranja-suave" : "text-texto/35"
                }`}
              >
                {seccion.titulo}
              </p>
              {seccion.subtitulo && (
                <p className="truncate font-mono text-[0.625rem] text-mudo">{seccion.subtitulo}</p>
              )}
            </div>
          )}
          {seccion.items.map((item) => {
            const activo = estaActivo(pathname, item.href, item.exacto);
            return (
              <Link
                key={item.href}
                href={item.href}
                // En móvil, elegir destino cierra el cajón: dejarlo abierto taparía
                // la pantalla a la que se acaba de entrar.
                onClick={() => setAbierto(false)}
                aria-current={activo ? "page" : undefined}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${ activo ? "bg-superficie-2 font-medium text-texto before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-naranja" : "text-atenuado hover:bg-superficie-2/60 hover:text-texto" }`}
              >
                <Icono nombre={item.icono} className="size-4 shrink-0" />
                <span className="flex-1 truncate">{item.etiqueta}</span>
                {/* Un contador en cero no informa de nada: se oculta. */}
                {item.pendiente && (
                  <span
                    title="Falta configurar esto para poder publicar"
                    className="shrink-0 font-mono text-[0.5625rem] font-bold text-ambar"
                  >
                    !
                  </span>
                )}
                {item.contador ? (
                  <span
                    className={`tabular shrink-0 rounded-full px-1.75 py-0.5 font-mono text-[0.625rem] font-semibold ${
                      item.urgente ? "bg-naranja/18 text-naranja-suave" : "bg-texto/8 text-atenuado"
                    }`}
                  >
                    {item.contador}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
      {pie && <div className="mt-auto px-2 pt-5">{pie}</div>}
    </nav>
  );

  return (
    <>
      {/* Barra superior solo en móvil: abre el cajón */}
      <div className="flex items-center gap-3 border-b border-linea px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          className="rounded-lg p-2 text-atenuado hover:bg-superficie-2"
        >
          <Icono nombre="menu" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      {/* Cajón móvil */}
      {abierto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setAbierto(false)}
            className="absolute inset-0 bg-black/40"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-linea bg-fondo">
            <div className="flex items-start justify-between gap-2 border-b border-linea p-4">
              <div className="min-w-0 flex-1">{children}</div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"
                className="rounded-lg p-1.5 text-mudo hover:bg-superficie-2"
              >
                <Icono nombre="cerrar" className="size-4" />
              </button>
            </div>
            {contenido}
          </aside>
        </div>
      )}

      {/* Sidebar fijo en escritorio */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-linea bg-fondo lg:sticky lg:top-0 lg:flex lg:h-dvh lg:self-start">
        <div className="border-b border-linea p-4">{children}</div>
        {contenido}
      </aside>
    </>
  );
}
