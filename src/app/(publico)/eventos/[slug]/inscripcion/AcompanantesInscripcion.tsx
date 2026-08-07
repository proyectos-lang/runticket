"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { EtiquetaMono } from "@/components/ui/Datos";
import { Select } from "@/components/ui/Select";
import { Campo } from "@/components/ui/Campo";
import { Boton } from "@/components/ui/Boton";
import { formatPrecio, formatDistancia } from "@/lib/format";
import { PARENTESCOS, SEXOS } from "@/lib/validacion/acompanantes";
import type { AcompananteInscribible } from "@/lib/acompanantes/inscribibles";
import { agregarAcompanante } from "./actions";

export type Seleccion = { id: string; categoriaId: string; talla: string | null };

/** Una persona ya elegida, resuelta con su precio, para el resumen del formulario. */
export type LineaAcompanante = {
  id: string;
  nombre: string;
  categoria: string;
  precio: number;
};

const VACIO = {
  nombres: "",
  apellidos: "",
  fechaNacimiento: "",
  sexo: "",
  parentesco: "hijo",
  correo: "",
};

/**
 * Inscribir a los acompañantes junto con uno mismo.
 *
 * Cada uno elige **su propia distancia**: lo normal es que el hijo corra los 5K
 * mientras el padre hace la 21K, así que ofrecer una categoría común sería
 * inservible. Las que no le corresponden por edad salen deshabilitadas con el
 * motivo, igual que en la lista del titular.
 *
 * La selección viaja en un único campo oculto con JSON en lugar de un campo por
 * persona: la lista es dinámica y así el servidor la valida de una vez, sin
 * reconstruirla adivinando nombres de campos.
 *
 * Se puede añadir a alguien **aquí mismo**. Antes había que irse a «Mis
 * acompañantes» y volver a empezar la inscripción, perdiendo la categoría, la
 * talla y la firma ya hechas; en la práctica eso significaba que casi nadie
 * inscribía a su familia. El alta llama al servidor por su cuenta y añade a la
 * persona al estado local, sin recargar ni reenviar el formulario grande.
 */
export function AcompanantesInscripcion({
  slug,
  acompanantes,
  moneda,
  tallas,
  alCambiar,
}: {
  slug: string;
  acompanantes: AcompananteInscribible[];
  moneda: string;
  tallas: { talla: string; inventario_disponible: number | null }[];
  /**
   * Le cuenta al formulario a quién se está inscribiendo y por cuánto.
   *
   * Sin esto, el resumen del último paso y el botón de confirmar solo sabían del
   * titular: la familia entera veía «L 450.00» y pagaba 1.050. El estado se
   * queda aquí —es de este bloque— y lo que sube es el resultado ya resuelto.
   */
  alCambiar?: (lineas: LineaAcompanante[]) => void;
}) {
  const [lista, setLista] = useState<AcompananteInscribible[]>(acompanantes);
  const [seleccion, setSeleccion] = useState<Seleccion[]>([]);

  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState(VACIO);
  const [errores, setErrores] = useState<Record<string, string[] | undefined>>({});
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, startAlta] = useTransition();

  const elegido = (id: string) => seleccion.find((s) => s.id === id);

  const primeraElegible = (a: AcompananteInscribible) => a.categorias.find((c) => c.elegible);

  function alternar(a: AcompananteInscribible) {
    setSeleccion((prev) => {
      if (prev.some((s) => s.id === a.id)) return prev.filter((s) => s.id !== a.id);
      return [
        ...prev,
        { id: a.id, categoriaId: primeraElegible(a)?.id ?? "", talla: a.tallaSugerida },
      ];
    });
  }

  const actualizar = (id: string, cambio: Partial<Seleccion>) =>
    setSeleccion((prev) => prev.map((s) => (s.id === id ? { ...s, ...cambio } : s)));

  const campo = (clave: keyof typeof VACIO) => (valor: string) => {
    setDatos((prev) => ({ ...prev, [clave]: valor }));
    // El error deja de tener sentido en cuanto se toca el campo que lo produjo.
    setErrores((prev) => ({ ...prev, [clave]: undefined }));
  };

  function guardar() {
    setMensaje(null);
    setErrores({});
    startAlta(async () => {
      const resultado = await agregarAcompanante(slug, datos);

      if (resultado.status === "error") {
        setErrores(resultado.errors ?? {});
        setMensaje(resultado.message ?? null);
        return;
      }

      const nuevo = resultado.acompanante;
      setLista((prev) => [...prev.filter((a) => a.id !== nuevo.id), nuevo]);

      // Se marca sola: quien acaba de darla de alta en mitad de una inscripción
      // la está añadiendo para inscribirla, no para archivarla.
      if (!nuevo.yaInscrito && primeraElegible(nuevo)) {
        setSeleccion((prev) => [
          ...prev.filter((s) => s.id !== nuevo.id),
          {
            id: nuevo.id,
            categoriaId: primeraElegible(nuevo)!.id,
            talla: nuevo.tallaSugerida,
          },
        ]);
      } else {
        setMensaje(
          nuevo.yaInscrito
            ? `${nuevo.nombre} ya tiene una inscripción activa en esta carrera.`
            : `${nuevo.nombre} quedó guardado, pero no hay ninguna categoría para su edad en esta carrera.`
        );
      }

      setDatos(VACIO);
      setAbierto(false);
    });
  }

  const lineas: LineaAcompanante[] = seleccion.map((s) => {
    const a = lista.find((x) => x.id === s.id);
    const c = a?.categorias.find((x) => x.id === s.categoriaId);
    return {
      id: s.id,
      nombre: a?.nombre ?? "Acompañante",
      categoria: c?.nombre ?? "",
      precio: Number(c?.precio_vigente ?? 0),
    };
  });
  const total = lineas.reduce((suma, l) => suma + l.precio, 0);

  // Se avisa por el contenido serializado y no por el array: este se recrea en
  // cada render y el efecto se dispararía en bucle.
  const huella = JSON.stringify(lineas);
  useEffect(() => {
    alCambiar?.(JSON.parse(huella) as LineaAcompanante[]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [huella]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <EtiquetaMono>¿Inscribes a alguien más?</EtiquetaMono>
        <Link
          href="/portal/acompanantes"
          className="font-mono text-[0.65625rem] uppercase tracking-etiqueta text-cian hover:underline"
        >
          Gestionar mi lista →
        </Link>
      </div>

      {lista.length === 0 && !abierto && (
        <p className="text-sm text-atenuado">
          Puedes inscribir a tus hijos o a tu pareja sin que ellos creen una cuenta. Quedan
          guardados para las siguientes carreras.
        </p>
      )}

      <input type="hidden" name="acompanantes" value={JSON.stringify(seleccion)} />

      {lista.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {lista.map((a) => {
            const sel = elegido(a.id);
            const sinCupo = !a.categorias.some((c) => c.elegible);
            const bloqueado = a.yaInscrito || sinCupo;

            return (
              <div
                key={a.id}
                className={`rounded-xl border px-5 py-4 transition-colors ${
                  sel ? "border-naranja/45 bg-naranja/6" : "border-linea bg-superficie"
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={!!sel}
                    disabled={bloqueado}
                    onChange={() => alternar(a)}
                    className="mt-1 size-4 shrink-0 accent-[var(--color-naranja)] disabled:opacity-40"
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-semibold text-texto">{a.nombre}</span>
                    <span className="font-mono text-[0.65625rem] uppercase tracking-etiqueta text-texto/45">
                      {[
                        a.parentesco,
                        a.edad !== null && `${a.edad} años el día de la carrera`,
                        a.yaInscrito && "Ya está inscrito",
                        !a.yaInscrito && sinCupo && "Sin categoría disponible por edad o cupo",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </label>

                {sel && (
                  <div className="mt-4 grid gap-3 border-t pt-4 border-linea sm:grid-cols-2">
                    <Select
                      label={`Distancia de ${a.nombre.split(" ")[0]}`}
                      name={`no-enviar-categoria-${a.id}`}
                      value={sel.categoriaId}
                      onChange={(v) => actualizar(a.id, { categoriaId: v })}
                      placeholder="Elige la distancia…"
                      opciones={a.categorias.map((c) => ({
                        valor: c.id,
                        etiqueta: c.elegible
                          ? `${c.nombre}${c.distancia_km !== null ? ` · ${formatDistancia(c.distancia_km)}` : ""} — ${formatPrecio(Number(c.precio_vigente), moneda)}`
                          : `${c.nombre} — ${c.motivo}`,
                      }))}
                    />
                    <Select
                      label="Talla"
                      name={`no-enviar-talla-${a.id}`}
                      value={sel.talla ?? ""}
                      onChange={(v) => actualizar(a.id, { talla: v || null })}
                      placeholder="Sin talla"
                      opciones={tallas
                        .filter((t) => t.inventario_disponible === null || t.inventario_disponible > 0)
                        .map((t) => ({ valor: t.talla, etiqueta: t.talla }))}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/*
        Nada de `<form>` aquí dentro: este bloque vive dentro del formulario de
        inscripción y el HTML no permite anidarlos. Por lo mismo ningún campo
        lleva `required`, que le impediría al navegador enviar la inscripción a
        quien nunca abrió este panel. Lo obligatorio lo valida el servidor con el
        mismo esquema que la pantalla de «Mis acompañantes».
      */}
      {abierto ? (
        <div className="flex flex-col gap-4 rounded-xl border border-cian/30 bg-cian/4 px-5 py-5">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-texto">Agregar a una persona</p>
            <p className="text-xs text-atenuado">
              Con la fecha de nacimiento se decide en qué categoría puede correr. No necesita
              cuenta ni correo.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              label="Nombres"
              name="no-enviar-nombres"
              value={datos.nombres}
              onChange={campo("nombres")}
              errors={errores.nombres}
            />
            <Campo
              label="Apellidos"
              name="no-enviar-apellidos"
              value={datos.apellidos}
              onChange={campo("apellidos")}
              errors={errores.apellidos}
            />
            <Campo
              label="Fecha de nacimiento"
              name="no-enviar-nacimiento"
              type="date"
              value={datos.fechaNacimiento}
              onChange={campo("fechaNacimiento")}
              errors={errores.fechaNacimiento}
            />
            <Select
              label="Sexo"
              name="no-enviar-sexo"
              value={datos.sexo}
              onChange={campo("sexo")}
              opciones={SEXOS}
              errors={errores.sexo}
            />
            <Select
              label="Parentesco"
              name="no-enviar-parentesco"
              value={datos.parentesco}
              onChange={campo("parentesco")}
              opciones={PARENTESCOS}
              errors={errores.parentesco}
            />
            {/*
              `type="text"` y no `type="email"` a propósito. Este campo vive
              dentro del formulario de inscripción, y un correo a medio escribir
              en un `type="email"` hace que el navegador **bloquee el envío de la
              inscripción entera** con un mensaje que no menciona a nadie. El
              formato lo valida el mismo esquema del servidor.
            */}
            <Campo
              label="Correo (opcional)"
              name="no-enviar-correo"
              value={datos.correo}
              onChange={campo("correo")}
              errors={errores.correo}
              ayuda="Solo si quieres que más adelante pueda entrar con su propia cuenta."
            />
          </div>

          {mensaje && (
            <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{mensaje}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* Secundaria a propósito: el naranja de esta pantalla es del botón
                que confirma la inscripción, y dos naranjas competirían. */}
            <Boton type="button" variante="secundaria" disabled={guardando} onClick={guardar}>
              {guardando ? "Guardando…" : "Guardar y agregar"}
            </Boton>
            <Boton
              type="button"
              variante="fantasma"
              disabled={guardando}
              onClick={() => {
                setAbierto(false);
                setErrores({});
                setMensaje(null);
              }}
            >
              Cancelar
            </Boton>
          </div>
        </div>
      ) : (
        <>
          <Boton
            type="button"
            variante="secundaria"
            className="self-start"
            onClick={() => {
              setMensaje(null);
              setAbierto(true);
            }}
          >
            + Agregar a una persona
          </Boton>
          {mensaje && <p className="text-sm text-ambar">{mensaje}</p>}
        </>
      )}

      {seleccion.length > 0 && (
        <p className="tabular text-right font-mono text-xs uppercase tracking-etiqueta text-atenuado">
          {seleccion.length} {seleccion.length === 1 ? "acompañante" : "acompañantes"} ·{" "}
          <span className="font-bold text-texto">{formatPrecio(total, moneda)}</span> además de lo tuyo
        </p>
      )}
    </section>
  );
}
