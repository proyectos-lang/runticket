"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { buscarFotos, type Foto } from "./actions";
import { Boton } from "@/components/ui/Boton";

export function BuscadorFotos({ slug }: { slug: string }) {
  const [dorsal, setDorsal] = useState("");
  const [fotos, setFotos] = useState<Foto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscando, startBusqueda] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startBusqueda(async () => {
            const res = await buscarFotos(slug, dorsal);
            if (res.status === "error") {
              setError(res.message);
              setFotos(null);
            } else {
              setFotos(res.fotos);
            }
          });
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="dorsal" className="text-sm font-medium text-atenuado">
            Tu número de dorsal
          </label>
          <input
            id="dorsal"
            inputMode="numeric"
            value={dorsal}
            onChange={(e) => setDorsal(e.target.value.replace(/\D/g, ""))}
            placeholder="1234"
            className="h-11 w-full rounded-md border border-azul/60 bg-superficie px-3.5 font-mono text-base font-semibold text-texto shadow-[inset_0_0_0_0.5px_var(--color-azul)] outline-none placeholder:font-sans placeholder:text-mudo sm:w-55"
          />
        </div>
        <Boton variante="primaria" type="submit" disabled={buscando || !dorsal}>
          {buscando ? "Buscando…" : "Buscar mis fotos"}
        </Boton>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {fotos && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-atenuado">
            {fotos.length
              ? `${fotos.length} ${fotos.length === 1 ? "foto encontrada" : "fotos encontradas"} para el dorsal ${dorsal}`
              : `No encontramos fotos del dorsal ${dorsal}. Puede que todavía no se hayan subido.`}
          </p>
          {fotos.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {fotos.map((f) => (
                <a
                  key={f.id}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative aspect-[4/3] overflow-hidden rounded-xl bg-superficie-2"
                >
                  <Image
                    src={f.url}
                    alt={`Foto del dorsal ${dorsal}`}
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className="object-cover transition-transform hover:scale-105"
                  />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
