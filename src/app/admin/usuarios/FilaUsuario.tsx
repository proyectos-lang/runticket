"use client";

import { useState, useTransition } from "react";
import { cambiarRolPlataforma } from "./actions";
import type { RolPlataforma } from "@/lib/supabase/database.types";

export function FilaUsuario({
  usuario,
}: {
  usuario: {
    id: string;
    nombre: string;
    correo: string;
    rolPlataforma: RolPlataforma;
    empresas: string[];
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
      <td className="px-4 py-3 text-atenuado">
        {usuario.empresas.length ? usuario.empresas.join(", ") : "—"}
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
      <td className="px-4 py-3 text-xs text-atenuado">
        {usuario.creadoEn.slice(0, 10)}
      </td>
    </tr>
  );
}
