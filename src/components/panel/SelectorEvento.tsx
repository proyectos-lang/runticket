"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CLASE_CAMPO } from "@/components/ui/Campo";
import { recordarCarreraActiva } from "@/lib/panel/acciones";

export type OpcionEvento = { id: string; nombre: string; estado: string };

/**
 * Elige sobre qué carrera trabaja un módulo de primer nivel.
 *
 * Escribe la elección en dos sitios y por motivos distintos: en `?evento=` de la
 * URL, para que sobreviva a una recarga y se pueda compartir el enlace de una
 * pantalla concreta; y en una cookie, para que **acompañe al usuario al cambiar
 * de módulo desde el menú**, cuyos enlaces son rutas limpias sin parámetros.
 */
export function SelectorEvento({
  eventos,
  seleccionado,
  incluirTodos = false,
}: {
  eventos: OpcionEvento[];
  seleccionado: string | null;
  /** Los módulos que saben agregar varias carreras ofrecen la opción «todas». */
  incluirTodos?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendiente, startTransition] = useTransition();

  if (eventos.length === 0) return null;

  return (
    <label className="flex flex-col gap-1" htmlFor="carreraActiva">
      <span className="text-xs font-medium uppercase tracking-wide text-atenuado">
        Carrera
      </span>
      <select
        id="carreraActiva"
        value={seleccionado ?? ""}
        disabled={pendiente}
        onChange={(e) => {
          const elegido = e.target.value;
          const nuevos = new URLSearchParams(params.toString());
          if (elegido) nuevos.set("evento", elegido);
          else nuevos.delete("evento");
          startTransition(async () => {
            // Primero el recuerdo y después la navegación: al revés, la ruta
            // nueva podría renderizarse antes de que la cookie estuviera puesta.
            await recordarCarreraActiva(elegido || null);
            router.push(`${pathname}?${nuevos.toString()}`);
          });
        }}
        className={`${CLASE_CAMPO} min-w-64`}
      >
        {incluirTodos && <option value="">Todas las carreras</option>}
        {eventos.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
            {e.estado !== "publicado" ? ` (${e.estado.replace(/_/g, " ")})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
