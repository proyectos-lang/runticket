"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { SubidorImagen } from "@/components/forms/SubidorImagen";
import { PRESETS } from "@/lib/imagenes/comprimir";
import { guardarLogo, quitarLogo } from "./actions";

export function LogoEmpresa({ empresaId, logo }: { empresaId: string; logo: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl border border-linea bg-superficie-2">
        {logo ? (
          <Image src={logo} alt="Logo de la empresa" fill sizes="96px" className="object-contain" />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-atenuado">
            Sin logo
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <SubidorImagen
          bucket="logos-empresa"
          carpeta={empresaId}
          prefijo="logo"
          preset={PRESETS.logo}
          etiqueta={logo ? "Reemplazar logo" : "Subir logo"}
          onSubido={async ([r]) => {
            if (r) await guardarLogo(empresaId, r.url);
          }}
        />
        {logo && (
          <button
            type="button"
            disabled={pendiente}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await quitarLogo(empresaId);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "No se pudo quitar el logo.");
                }
              });
            }}
            className="self-start text-sm underline-offset-2 hover:underline disabled:opacity-50 text-red-400"
          >
            Quitar logo
          </button>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
