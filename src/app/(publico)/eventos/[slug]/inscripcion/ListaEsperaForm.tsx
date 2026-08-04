"use client";

import { useState, useTransition } from "react";
import { Boton } from "@/components/ui/Boton";
import { EtiquetaMono } from "@/components/ui/Datos";
import { apuntarseListaEspera } from "./actions";
import type { CategoriaElegible } from "./InscripcionForm";

/**
 * Lista de espera de una carrera agotada.
 *
 * Va en cian y no en ámbar: no es una advertencia de que algo va mal, es la
 * salida que la pantalla ofrece. El ámbar la haría parecer un error del
 * corredor cuando el cupo lo llenó otra gente.
 */
export function ListaEsperaForm({
  slug,
  categorias,
  yaApuntado,
}: {
  slug: string;
  categorias: CategoriaElegible[];
  /** Categorías en las que el corredor ya está en cola. */
  yaApuntado: string[];
}) {
  const [pendiente, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [apuntadas, setApuntadas] = useState<string[]>(yaApuntado);

  // Solo tiene sentido ofrecer espera donde el problema es el cupo: si no cumple
  // la edad, esperar no le va a servir de nada.
  const porCupo = categorias.filter((c) => c.motivoNoElegible === "Cupo agotado");
  if (!porCupo.length) return null;

  const plazas = porCupo.reduce((a, c) => a + (c.cupo_maximo ?? 0), 0);

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-cian/32 bg-cian/6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-cian/40 bg-cian/14 px-2.5 py-1 font-mono text-[0.59375rem] font-bold uppercase tracking-etiqueta text-cian">
          Cupo agotado
        </span>
        {plazas > 0 && (
          <EtiquetaMono>
            {plazas} / {plazas} plazas
          </EtiquetaMono>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-extrabold tracking-display text-texto">
          Apúntate a la lista de espera
        </h2>
        <p className="text-[0.8125rem] leading-relaxed text-atenuado">
          Si alguien cancela avisamos por orden de llegada, y tendrás 24 horas para completar tu
          inscripción antes de que la plaza pase al siguiente.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {porCupo.map((c, i) => {
          const dentro = apuntadas.includes(c.id);
          return (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-linea bg-superficie px-4 py-3.5"
            >
              <div className="flex flex-col">
                <span className="font-bold text-texto">{c.nombre}</span>
                {dentro && (
                  <span className="font-mono text-[0.65625rem] uppercase tracking-etiqueta text-cian">
                    Estás en la lista
                  </span>
                )}
              </div>

              {dentro ? (
                <span className="font-mono text-[0.65625rem] uppercase tracking-etiqueta text-mudo">
                  Te avisaremos
                </span>
              ) : (
                // Solo la primera categoría lleva el botón naranja: con tres
                // botones naranja no destacaría ninguno.
                <Boton
                  variante={i === 0 ? "primaria" : "secundaria"}
                  tamano="sm"
                  disabled={pendiente}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await apuntarseListaEspera(slug, c.id);
                      if (res.status === "apuntado") {
                        setApuntadas((prev) => [...prev, c.id]);
                        setMensaje({ tipo: "ok", texto: `Te apuntamos a la cola de ${c.nombre}.` });
                      } else {
                        setMensaje({ tipo: "error", texto: res.message ?? "No se pudo apuntar." });
                      }
                    })
                  }
                >
                  {pendiente ? "Apuntando…" : "Apuntarme"}
                </Boton>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center font-mono text-[0.65625rem] uppercase tracking-etiqueta text-mudo">
        Apuntarse no compromete ningún pago
      </p>

      {mensaje && (
        <p className={`text-sm ${mensaje.tipo === "ok" ? "text-cian" : "text-rojo"}`}>
          {mensaje.texto}
        </p>
      )}
    </section>
  );
}
