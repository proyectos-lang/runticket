"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cambiarRolPlataforma } from "./actions";
import type { RolEmpresa, RolPlataforma } from "@/lib/supabase/database.types";

const ROL_EMPRESA: Record<RolEmpresa, string> = {
  admin_empresa: "Administrador",
  operador: "Operador",
};

/**
 * Una fila del listado global de usuarios.
 *
 * **Los dos roles de RunTicket son ejes distintos, no escalones de una misma
 * escalera**, y esta fila tiene que enseñarlo o se lee mal:
 *
 * - *Rol de plataforma* (`usuario` / `super_admin`) es de la persona y hay uno
 *   solo. Es lo que se edita aquí.
 * - *Rol de empresa* (`admin_empresa` / `operador`) es **por empresa**: la misma
 *   persona puede administrar una y ser solo operadora en otra. Por eso no cabe
 *   en el desplegable de al lado; se edita en el equipo de cada empresa.
 *
 * Antes esta columna era el nombre de la empresa en texto plano, sin el rol y
 * sin enlace. Desde aquí no se veía quién administraba qué ni había forma de
 * llegar a cambiarlo, así que el nivel intermedio parecía no existir.
 *
 * **El editor de rol de empresa no se duplica aquí a propósito.** El de
 * `FilaMiembro` bloquea degradar al único administrador activo de una empresa,
 * que es lo que impide dejarla sin nadie que la gobierne. Una segunda copia de
 * ese control acabaría separándose de la primera, y el día que se separe la
 * empresa se queda huérfana. Se enlaza al que ya existe.
 */
export function FilaUsuario({
  usuario,
}: {
  usuario: {
    id: string;
    nombre: string;
    correo: string;
    rolPlataforma: RolPlataforma;
    empresas: { id: string; nombre: string; rol: RolEmpresa }[];
    creadoEn: string;
  };
}) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <tr className="bg-superficie/40">
      <td className="px-4 py-3">
        <p className="font-medium text-texto">{usuario.nombre || "—"}</p>
        <p className="text-xs text-atenuado">{usuario.correo}</p>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </td>

      <td className="px-4 py-3">
        {usuario.empresas.length ? (
          <ul className="flex flex-col gap-1">
            {usuario.empresas.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/admin/empresas/${e.id}`}
                  className="group inline-flex flex-wrap items-baseline gap-x-2"
                  title={`Gestionar el equipo de ${e.nombre}`}
                >
                  <span className="text-atenuado underline-offset-2 group-hover:text-texto group-hover:underline">
                    {e.nombre}
                  </span>
                  <span
                    className={`font-mono text-[0.625rem] uppercase tracking-etiqueta ${
                      e.rol === "admin_empresa" ? "text-cian" : "text-mudo"
                    }`}
                  >
                    {ROL_EMPRESA[e.rol]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-atenuado">—</span>
        )}
      </td>

      <td className="px-4 py-3">
        <select
          value={usuario.rolPlataforma}
          disabled={pendiente}
          aria-label={`Rol de plataforma de ${usuario.correo}`}
          onChange={(e) => {
            setError(null);
            startTransition(async () => {
              try {
                await cambiarRolPlataforma(usuario.id, e.target.value as RolPlataforma);
              } catch (err) {
                setError(err instanceof Error ? err.message : "No se pudo cambiar el rol.");
              }
            });
          }}
          className="rounded-lg border px-2 py-1 text-sm disabled:opacity-60 border-linea-fuerte bg-superficie text-texto"
        >
          <option value="usuario">Usuario</option>
          <option value="super_admin">Super administrador</option>
        </select>
      </td>

      <td className="px-4 py-3 text-xs text-atenuado">{usuario.creadoEn.slice(0, 10)}</td>
    </tr>
  );
}
