"use client";

import { useTransition } from "react";
import { seleccionarEmpresaActiva } from "@/lib/auth/actions";
import { ROL_EMPRESA } from "@/lib/estados";
import { ChipEstado } from "@/components/ui/Chip";
import type { MembresiaEmpresa } from "@/lib/auth/session";

/**
 * Elección explícita cuando el usuario pertenece a varias empresas. Antes se
 * entraba en la primera que devolviera la base de datos, y si esa era una donde
 * es operador desaparecía medio panel sin ninguna explicación.
 */
export function ElegirEmpresa({ membresias }: { membresias: MembresiaEmpresa[] }) {
  const [pendiente, startTransition] = useTransition();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-texto">
          ¿Con qué empresa quieres trabajar?
        </h1>
        <p className="mt-2 text-sm text-atenuado">
          Perteneces a varias. Podrás cambiar en cualquier momento desde el menú.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {membresias.map((m) => (
          <button
            key={m.empresaId}
            type="button"
            disabled={pendiente}
            onClick={() => startTransition(() => seleccionarEmpresaActiva(m.empresaId))}
            className="flex items-center justify-between gap-4 rounded-xl border px-5 py-4 text-left disabled:opacity-60 border-linea bg-superficie hover:border-texto/25"
          >
            <span className="font-medium text-texto">{m.nombreComercial}</span>
            <ChipEstado estilo={ROL_EMPRESA[m.rol]} />
          </button>
        ))}
      </div>
    </main>
  );
}
