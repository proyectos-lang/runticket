"use client";

import Image from "next/image";
import { PlacaLogo } from "@/components/ui/Datos";
import { Aviso } from "@/components/ui/Aviso";
import { useActionState, useState, useTransition } from "react";
import { Campo } from "@/components/ui/Campo";
import { SubidorImagen } from "@/components/forms/SubidorImagen";
import { PRESETS } from "@/lib/imagenes/comprimir";
import {
  guardarPatrocinador,
  eliminarPatrocinador,
  moverPatrocinador,
  type PatrocinadorState,
} from "./actions";
import { Boton } from "@/components/ui/Boton";

const initialState: PatrocinadorState = { status: "idle" };

export type Patrocinador = {
  id: string;
  nombre: string;
  logo_url: string | null;
  url_sitio: string | null;
};

function Formulario({
  eventoId,
  carpeta,
  patrocinador,
  onCerrar,
}: {
  eventoId: string;
  carpeta: string;
  patrocinador?: Patrocinador;
  onCerrar?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    guardarPatrocinador.bind(null, eventoId, patrocinador?.id ?? null),
    initialState
  );
  // El logo viaja en un campo oculto: el archivo lo sube el navegador a Storage
  // y lo que se guarda con el formulario es su URL, junto al nombre y la web.
  const [logoUrl, setLogoUrl] = useState(patrocinador?.logo_url ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          label="Nombre"
          name="nombre"
          required
          placeholder="Banco Atlántida"
          defaultValue={patrocinador?.nombre}
          errors={state.errors?.nombre}
        />
        <Campo
          label="Sitio web"
          name="urlSitio"
          type="url"
          placeholder="https://ejemplo.com"
          defaultValue={patrocinador?.url_sitio ?? ""}
          ayuda="Opcional: su logo enlazará ahí."
          errors={state.errors?.urlSitio}
        />
      </div>

      <input type="hidden" name="logoUrl" value={logoUrl} />

      <div className="flex flex-wrap items-start gap-4 rounded-xl border p-4 border-linea">
        {/* La vista previa va sobre la placa clara real de la ficha pública: es
            la única forma de ver si un logo de tinta oscura con transparencia
            se lee, que es justo lo que se rompe sobre el fondo del sistema. */}
        <PlacaLogo className="h-16 w-32 shrink-0">
          {logoUrl ? (
            <span className="relative size-full">
              <Image src={logoUrl} alt="" fill sizes="128px" className="object-contain" />
            </span>
          ) : (
            <span className="font-mono text-[0.625rem] font-bold uppercase tracking-etiqueta text-fondo/45">
              Sin logo
            </span>
          )}
        </PlacaLogo>

        <div className="flex min-w-56 flex-1 flex-col gap-2">
          <SubidorImagen
            bucket="eventos"
            carpeta={carpeta}
            prefijo={`patrocinador-${patrocinador?.id.slice(0, 8) ?? "nuevo"}`}
            preset={PRESETS.logo}
            etiqueta={logoUrl ? "Reemplazar logo" : "Subir logo"}
            onSubido={([r]) => {
              if (r) setLogoUrl(r.url);
            }}
          />
          {logoUrl && (
            <button
              type="button"
              onClick={() => setLogoUrl("")}
              className="self-start text-xs underline-offset-2 hover:underline text-atenuado"
            >
              Quitar logo
            </button>
          )}
          <p className="text-xs text-mudo">
            Sin logo, en la ficha pública aparece solo el nombre en texto.
          </p>
        </div>
      </div>

      {state.status === "error" && state.message && (
        <p className="text-sm text-red-400">{state.message}</p>
      )}
      {state.status === "guardado" && (
        <p className="text-sm text-emerald-400">Guardado.</p>
      )}

      <div className="flex gap-2">
        <Boton variante="primaria" type="submit" disabled={pending}>
          {pending ? "Guardando…" : patrocinador ? "Guardar" : "Añadir patrocinador"}
        </Boton>
        {onCerrar && (
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-full border px-5 py-2.5 text-sm font-medium border-linea-fuerte text-atenuado hover:bg-superficie-2"
          >
            {state.status === "guardado" ? "Cerrar" : "Cancelar"}
          </button>
        )}
      </div>
    </form>
  );
}

export function GestorPatrocinadores({
  eventoId,
  carpeta,
  patrocinadores,
}: {
  eventoId: string;
  carpeta: string;
  patrocinadores: Patrocinador[];
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

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

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p className="rounded-lg px-3 py-2 text-sm bg-red-950 text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {patrocinadores.map((p, i) => (
          <div
            key={p.id}
            className="flex flex-col gap-4 rounded-2xl border p-5 border-linea bg-superficie"
          >
            {editando === p.id ? (
              <Formulario
                eventoId={eventoId}
                carpeta={carpeta}
                patrocinador={p}
                onCerrar={() => setEditando(null)}
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Placa clara: es la vista previa real de cómo se ve en la
                      ficha pública. Sobre el fondo del sistema, un logo de tinta
                      oscura con transparencia desaparecería. */}
                  <PlacaLogo className="h-14 w-26 shrink-0">
                    {p.logo_url ? (
                      <span className="relative size-full">
                        <Image src={p.logo_url} alt={p.nombre} fill sizes="104px" className="object-contain" />
                      </span>
                    ) : (
                      <span className="font-mono text-[0.625rem] font-bold uppercase tracking-etiqueta text-fondo/45">
                        Sin logo
                      </span>
                    )}
                  </PlacaLogo>
                  <div>
                    <p className="font-medium text-texto">{p.nombre}</p>
                    {p.url_sitio && (
                      <p className="text-xs text-atenuado">{p.url_sitio}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <button
                    type="button"
                    disabled={pendiente || i === 0}
                    onClick={() => ejecutar(() => moverPatrocinador(eventoId, p.id, -1))}
                    aria-label="Subir"
                    className="disabled:opacity-30 text-atenuado"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={pendiente || i === patrocinadores.length - 1}
                    onClick={() => ejecutar(() => moverPatrocinador(eventoId, p.id, 1))}
                    aria-label="Bajar"
                    className="disabled:opacity-30 text-atenuado"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setEditando(p.id);
                    }}
                    className="underline-offset-2 hover:underline text-atenuado"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => {
                      if (confirm(`¿Eliminar a ${p.nombre}?`)) {
                        ejecutar(() => eliminarPatrocinador(eventoId, p.id));
                      }
                    }}
                    className="underline-offset-2 hover:underline disabled:opacity-50 text-red-400"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {patrocinadores.length === 0 && (
          <p className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm border-linea-fuerte text-atenuado">
            Sin patrocinadores. Los que añadas aparecerán en la página pública del evento, en el
            dorsal y en el certificado de participación.
          </p>
        )}
      </div>

      <section className="rounded-2xl border p-6 border-linea bg-superficie">
        <h3 className="mb-4 text-base font-semibold text-texto">
          Añadir patrocinador
        </h3>
        <Formulario eventoId={eventoId} carpeta={carpeta} />
      </section>
      <Aviso tono="azul">
        Así se verá cada logo en la ficha pública: sobre una placa clara de 54 px de alto, en
        una fila con 10 px de separación. La placa no es decoración — un logo de tinta oscura
        con fondo transparente desaparecería sobre el fondo del sistema.
      </Aviso>

    </div>
  );
}
