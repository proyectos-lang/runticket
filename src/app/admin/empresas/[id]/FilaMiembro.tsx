"use client";

import { useState, useTransition } from "react";
import { ChipEstado } from "@/components/ui/Chip";
import { ESTADO_MEMBRESIA } from "@/lib/estados";
import { cambiarEstadoMiembro, cambiarRolMiembro, eliminarMiembro } from "./actions";
import type { EstadoMembresia, RolEmpresa } from "@/lib/supabase/database.types";

export function FilaMiembro({
  empresaId,
  miembro,
  esUltimoAdmin,
}: {
  empresaId: string;
  miembro: {
    usuarioId: string;
    nombre: string;
    correo: string;
    rol: RolEmpresa;
    estado: EstadoMembresia;
  };
  /** Si es el único admin activo, sus controles se bloquean con explicación. */
  esUltimoAdmin: boolean;
}) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function ejecutar(accion: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await accion();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
      }
    });
  }

  const bloqueado = pendiente || esUltimoAdmin;
  const motivo = esUltimoAdmin
    ? "Es el único administrador activo: nombra a otro antes de cambiarlo."
    : undefined;

  return (
    <tr className="bg-superficie/40">
      <td className="px-4 py-3">
        <p className="font-medium text-texto">{miembro.nombre || "—"}</p>
        <p className="text-xs text-atenuado">{miembro.correo}</p>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </td>
      <td className="px-4 py-3">
        <select
          value={miembro.rol}
          disabled={bloqueado}
          title={motivo}
          onChange={(e) =>
            ejecutar(() => cambiarRolMiembro(empresaId, miembro.usuarioId, e.target.value as RolEmpresa))
          }
          className="rounded-lg border px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60 border-linea-fuerte bg-superficie text-texto"
          aria-label={`Rol de ${miembro.correo}`}
        >
          <option value="admin_empresa">Administrador</option>
          <option value="operador">Operador</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <ChipEstado estilo={ESTADO_MEMBRESIA[miembro.estado]} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-3 text-sm">
          {miembro.estado === "activo" ? (
            <button
              type="button"
              disabled={bloqueado}
              title={motivo}
              onClick={() => ejecutar(() => cambiarEstadoMiembro(empresaId, miembro.usuarioId, "suspendido"))}
              className="underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50 text-amber-400"
            >
              Suspender
            </button>
          ) : (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => ejecutar(() => cambiarEstadoMiembro(empresaId, miembro.usuarioId, "activo"))}
              className="underline-offset-2 hover:underline disabled:opacity-50 text-emerald-400"
            >
              Activar
            </button>
          )}
          <button
            type="button"
            disabled={bloqueado}
            title={motivo}
            onClick={() => {
              if (confirm(`¿Quitar a ${miembro.correo} del equipo?`)) {
                ejecutar(() => eliminarMiembro(empresaId, miembro.usuarioId));
              }
            }}
            className="underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50 text-red-400"
          >
            Quitar
          </button>
        </div>
      </td>
    </tr>
  );
}
