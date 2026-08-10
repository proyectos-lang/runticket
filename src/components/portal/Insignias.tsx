/* eslint-disable @next/next/no-img-element */
import { EncabezadoSeccion } from "./Historial";
import type { InsigniaDeCorredor } from "@/lib/supabase/database.types";

/**
 * Las insignias ganadas, en el perfil del corredor (9.6).
 *
 * **No se pinta si no hay ninguna.** Es la misma regla que sigue la tira de
 * métricas de esta pantalla: una rejilla de huecos grises rotulada «insignias»
 * no motiva a nadie, informa de que le falta algo. Aparece cuando hay algo que
 * celebrar.
 *
 * Cada insignia lleva el nombre del organizador que la concedió. Sin eso, un
 * corredor con insignias de tres empresas vería una colección sin dueño y no
 * entendería por qué su «3 carreras» no cuenta las que corrió con otro.
 *
 * El icono va sobre placa clara por la misma razón que los logos de
 * patrocinadores: lo sube el organizador y un PNG de tinta oscura con
 * transparencia desaparecería sobre el fondo del sistema. Con `<img>` y no
 * `next/image` porque la URL es arbitraria y no está entre los hosts
 * autorizados en `next.config.ts`.
 */
export function Insignias({ insignias }: { insignias: InsigniaDeCorredor[] }) {
  if (insignias.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <EncabezadoSeccion>Insignias</EncabezadoSeccion>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {insignias.map((i) => (
          <li
            key={`${i.empresa}-${i.codigo}`}
            className="flex items-center gap-3.5 rounded-xl border border-linea bg-superficie px-4 py-3.5"
          >
            <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-texto">
              {i.icono_url ? (
                <img src={i.icono_url} alt="" className="size-full object-cover" />
              ) : (
                <span className="text-lg font-black text-fondo">{i.nombre.charAt(0)}</span>
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-texto">{i.nombre}</p>
              {i.descripcion && (
                <p className="truncate text-sm text-atenuado">{i.descripcion}</p>
              )}
              <p className="truncate font-mono text-[0.625rem] uppercase tracking-etiqueta text-mudo">
                {i.empresa}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
