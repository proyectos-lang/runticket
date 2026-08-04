"use client";

import { useTransition } from "react";
import { seleccionarEmpresaActiva } from "@/lib/auth/actions";
import { ROL_EMPRESA } from "@/lib/estados";
import type { MembresiaEmpresa } from "@/lib/auth/session";

export function SelectorEmpresa({
  membresias,
  activa,
}: {
  membresias: MembresiaEmpresa[];
  activa: MembresiaEmpresa;
}) {
  const [pendiente, startTransition] = useTransition();

  // Con una sola empresa el selector es ruido: se muestra la identidad y ya.
  if (membresias.length <= 1) {
    return (
      <div className="min-w-0">
        <p className="truncate font-semibold text-texto">
          {activa.nombreComercial}
        </p>
        <p className="truncate text-xs text-atenuado">
          {ROL_EMPRESA[activa.rol].etiqueta}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor="empresaActiva" className="text-xs text-atenuado">
        Empresa
      </label>
      <select
        id="empresaActiva"
        value={activa.empresaId}
        disabled={pendiente}
        onChange={(e) => startTransition(() => seleccionarEmpresaActiva(e.target.value))}
        className="w-full rounded-lg border px-2 py-1.5 text-sm font-medium disabled:opacity-60 border-linea-fuerte bg-superficie text-texto"
      >
        {membresias.map((m) => (
          <option key={m.empresaId} value={m.empresaId}>
            {m.nombreComercial}
          </option>
        ))}
      </select>
      <p className="truncate text-xs text-atenuado">
        {ROL_EMPRESA[activa.rol].etiqueta}
      </p>
    </div>
  );
}
