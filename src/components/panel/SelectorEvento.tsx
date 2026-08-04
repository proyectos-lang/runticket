"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CLASE_CAMPO } from "@/components/ui/Campo";

export type OpcionEvento = { id: string; nombre: string; estado: string };

/**
 * Elige sobre qué carrera trabaja un módulo de primer nivel. Escribe `?evento=`
 * en la URL para que la selección sobreviva a recargas y se pueda compartir el
 * enlace de una pantalla concreta.
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
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-atenuado">
        Carrera
      </span>
      <select
        value={seleccionado ?? ""}
        disabled={pendiente}
        onChange={(e) => {
          const nuevos = new URLSearchParams(params.toString());
          if (e.target.value) nuevos.set("evento", e.target.value);
          else nuevos.delete("evento");
          startTransition(() => router.push(`${pathname}?${nuevos.toString()}`));
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
