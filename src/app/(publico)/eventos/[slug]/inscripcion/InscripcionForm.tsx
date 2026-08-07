"use client";

import { useActionState, useState, useTransition } from "react";
import {
  AcompanantesInscripcion,
  type LineaAcompanante,
} from "./AcompanantesInscripcion";
import type { AcompananteInscribible } from "@/lib/acompanantes/inscribibles";
import Link from "next/link";
import { FirmaCanvas } from "@/components/forms/FirmaCanvas";
import { Boton } from "@/components/ui/Boton";
import { BarraPasos } from "@/components/ui/BarraPasos";
import { RadioFila } from "@/components/ui/RadioFila";
import { EtiquetaMono } from "@/components/ui/Datos";
import { Aviso } from "@/components/ui/Aviso";
import { Campo, CLASE_CAMPO, Etiqueta } from "@/components/ui/Campo";
import { formatPrecio, formatDistancia } from "@/lib/format";
import { inscribirse, comprobarCupon, type InscripcionState, type CuponState } from "./actions";
import type { CategoriaConCupo } from "@/lib/eventos/consultas";

const initialState: InscripcionState = { status: "idle" };

const PASOS = ["Tu carrera", "Tus datos", "Firma"];

export type CategoriaElegible = CategoriaConCupo & {
  elegible: boolean;
  motivoNoElegible: string | null;
};

export function InscripcionForm({
  slug,
  categorias,
  tallas,
  moneda,
  declaracion,
  esMenor,
  // Los que ya tiene guardados en su lista; los elegidos para esta carrera son
  // otra cosa y viven en el estado de abajo.
  acompanantes: acompanantesGuardados,
  perfil,
  categoriaInicial,
}: {
  slug: string;
  categorias: CategoriaElegible[];
  tallas: { talla: string; inventario_disponible: number | null }[];
  moneda: string;
  declaracion: { version: number; contenido: string };
  esMenor: boolean;
  acompanantes: AcompananteInscribible[];
  perfil: { nombres: string; apellidos: string; correo: string; tallaPredeterminada: string | null };
  /** Preselección que llega del selector de distancia de la ficha del evento. */
  categoriaInicial?: string;
}) {
  const boundAction = inscribirse.bind(null, slug);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const disponibles = categorias.filter((c) => c.elegible);
  const [paso, setPaso] = useState(0);
  const [categoriaId, setCategoriaId] = useState(
    disponibles.some((c) => c.id === categoriaInicial)
      ? categoriaInicial!
      : (disponibles[0]?.id ?? "")
  );
  const [talla, setTalla] = useState(
    tallas.some((t) => t.talla === perfil.tallaPredeterminada && (t.inventario_disponible ?? 1) > 0)
      ? perfil.tallaPredeterminada!
      : ""
  );
  const [firmado, setFirmado] = useState(false);
  const [acepto, setAcepto] = useState(false);
  const [cupon, setCupon] = useState("");
  const [estadoCupon, setEstadoCupon] = useState<CuponState>({ status: "idle" });
  const [comprobando, startComprobacion] = useTransition();
  const seleccionada = categorias.find((c) => c.id === categoriaId);

  /**
   * Quién más va, con su precio ya resuelto. Lo mantiene el bloque de
   * acompañantes —el estado es suyo— y sube aquí para que el resumen y el botón
   * hablen del importe de verdad y no solo del titular.
   */
  const [acompanantes, setAcompanantes] = useState<LineaAcompanante[]>([]);
  const totalAcompanantes = acompanantes.reduce((a, l) => a + l.precio, 0);
  const total = Number(seleccionada?.precio_vigente ?? 0) + totalAcompanantes;
  const personas = acompanantes.length + 1;

  const tallasConStock = tallas.filter(
    (t) => t.inventario_disponible === null || t.inventario_disponible > 0
  );

  // Los errores del servidor solo llegan tras enviar, y solo se envía en el
  // último paso. Si el error pertenece a uno anterior hay que volver a él, o el
  // corredor ve un formulario que falla sin decirle dónde.
  const errorEnPaso1 = Boolean(state.errors?.categoriaId?.[0]);
  const pasoVisible = errorEnPaso1 ? 0 : paso;

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <BarraPasos pasos={PASOS} actual={pasoVisible} />

      {/*
        Los pasos se ocultan con CSS, no se desmontan. Al desmontarlos, sus
        campos salen del DOM y `FormData` no los recoge: el envío del último
        paso llegaría sin la categoría ni la talla.
      */}
      <section className={`flex flex-col gap-4 ${pasoVisible === 0 ? "" : "hidden"}`}>
        <EtiquetaMono>Elige tu distancia</EtiquetaMono>
        <div className="flex flex-col gap-2">
          {categorias.map((c) => (
            <RadioFila
              key={c.id}
              name="categoriaId"
              value={c.id}
              checked={categoriaId === c.id}
              disabled={!c.elegible}
              onChange={setCategoriaId}
              titulo={
                <span className="flex flex-wrap items-baseline gap-2">
                  {c.nombre}
                  {c.distancia_km !== null && (
                    <span className="tabular font-mono text-xs text-cian">
                      {formatDistancia(c.distancia_km)}
                    </span>
                  )}
                </span>
              }
              detalle={
                <span className="tabular font-mono text-xs">
                  {c.motivoNoElegible ??
                    (c.cupos_disponibles === null
                      ? "Cupo abierto"
                      : `${c.cupos_disponibles} plazas libres`)}
                </span>
              }
              derecha={
                <span
                  className={`tabular font-extrabold ${
                    categoriaId === c.id ? "text-naranja" : "text-texto"
                  }`}
                >
                  {formatPrecio(Number(c.precio_vigente), moneda)}
                </span>
              }
            />
          ))}
        </div>
        {state.errors?.categoriaId?.[0] && (
          <p className="text-sm text-red-300">{state.errors.categoriaId[0]}</p>
        )}

        {/* Va aquí y no en un paso propio: quien corre en familia decide a la
            vez qué corre cada uno, y separarlo obligaría a volver atrás. */}
        <AcompanantesInscripcion
          slug={slug}
          acompanantes={acompanantesGuardados}
          moneda={moneda}
          tallas={tallas}
          alCambiar={setAcompanantes}
        />
      </section>

      <section className={`flex flex-col gap-5 ${pasoVisible === 1 ? "" : "hidden"}`}>
        <div className="flex items-center gap-4 rounded-xl border border-linea bg-superficie px-5 py-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-naranja text-base font-extrabold text-texto">
            {(perfil.nombres[0] ?? "") + (perfil.apellidos[0] ?? "")}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="truncate font-bold text-texto">
              {perfil.nombres} {perfil.apellidos}
            </p>
            <p className="truncate font-mono text-[0.71875rem] text-atenuado">{perfil.correo}</p>
            <Link
              href={`/portal/perfil?next=/eventos/${slug}/inscripcion`}
              className="mt-1 self-start font-mono text-[0.6875rem] uppercase tracking-etiqueta text-cian hover:underline"
            >
              Editar mis datos →
            </Link>
          </div>
        </div>

        <Aviso tono="azul">
          Tu categoría se calcula con tu fecha de nacimiento y tu sexo, así que no hay que
          elegirla. Si alguno de los dos está mal, corrígelo en tu perfil antes de continuar.
        </Aviso>

        {tallasConStock.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Etiqueta required>Talla de camiseta</Etiqueta>
            {/* Chips y no un selector: con seis tallas, ver el inventario de
                todas de un vistazo evita elegir una que está a punto de agotarse. */}
            <div className="flex flex-wrap gap-2">
              {tallas.map((t) => {
                const agotada = t.inventario_disponible !== null && t.inventario_disponible <= 0;
                const elegida = talla === t.talla;
                return (
                  <button
                    key={t.talla}
                    type="button"
                    disabled={agotada}
                    onClick={() => setTalla(elegida ? "" : t.talla)}
                    aria-pressed={elegida}
                    className={`flex items-center gap-1.5 rounded-md border px-3.5 py-3 text-sm font-medium transition-colors ${
                      agotada
                        ? "cursor-not-allowed border-linea text-texto/32 line-through"
                        : elegida
                          ? "border-naranja bg-naranja/6 text-texto shadow-[inset_0_0_0_0.5px_var(--color-naranja)]"
                          : "border-linea-fuerte text-atenuado hover:border-texto/25 hover:text-texto"
                    }`}
                  >
                    {t.talla}
                    {t.inventario_disponible !== null && (
                      <span
                        className={`tabular font-mono text-xs ${elegida ? "text-naranja-suave" : "text-texto/40"}`}
                      >
                        ({t.inventario_disponible})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="talla" value={talla} />
          </div>
        ) : (
          <Aviso tono="ambar">
            No quedan tallas con existencias. Puedes inscribirte igualmente; el organizador
            entregará la prenda según disponibilidad.
          </Aviso>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Club (opcional)" name="club" errors={state.errors?.club} />
          <Campo label="Equipo (opcional)" name="equipo" errors={state.errors?.equipo} />
        </div>
        <Campo
          label="Alergias o condiciones a considerar (opcional)"
          name="alergias"
          errors={state.errors?.alergias}
        />
      </section>

      <section className={`flex flex-col gap-5 ${pasoVisible === 2 ? "" : "hidden"}`}>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <EtiquetaMono>Declaración de salud</EtiquetaMono>
            <span className="font-mono text-[0.65625rem] uppercase tracking-etiqueta text-texto/45">
              Versión {declaracion.version}
            </span>
          </div>
          {/* El degradado inferior indica que el texto sigue: sin él, la caja
              parece terminar justo donde se corta. */}
          <div className="relative">
            <div className="h-45 overflow-y-auto whitespace-pre-line rounded-lg border border-texto/10 bg-superficie px-4.5 py-4 text-[0.78125rem] leading-relaxed text-texto/70">
              {declaracion.contenido}
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-px bottom-px h-11 rounded-b-lg"
              style={{ background: "linear-gradient(to bottom, transparent, var(--color-superficie))" }}
            />
          </div>
        </div>

        {esMenor && (
          <div className="flex flex-col gap-4 rounded-lg border border-amber-500/38 bg-amber-500/9 p-5">
            <p className="text-sm font-bold text-ambar">
              Corredor menor de edad — datos del tutor
            </p>
            <p className="font-mono text-[0.6875rem] leading-relaxed text-ambar/70">
              La declaración la firma el padre, madre o tutor, y se guarda con su documento.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                label="Nombre del tutor"
                name="tutorNombre"
                required
                errors={state.errors?.tutorNombre}
              />
              <Campo
                label="Documento del tutor"
                name="tutorDocumento"
                required
                errors={state.errors?.tutorDocumento}
              />
            </div>
          </div>
        )}

        <FirmaCanvas name="firmaPng" alCambiar={setFirmado} />

        <label className="flex cursor-pointer items-start gap-3 text-[0.78125rem] leading-relaxed text-atenuado">
          <input
            type="checkbox"
            name="acepto"
            value="on"
            checked={acepto}
            onChange={(e) => setAcepto(e.target.checked)}
            className="mt-0.5 size-4.5 shrink-0 rounded accent-naranja"
          />
          <span>
            He leído y acepto la declaración de salud y el deslinde de responsabilidad, así como los
            términos y la política de privacidad de RunTicket.
          </span>
        </label>
        {state.errors?.acepto?.[0] && (
          <p className="text-sm text-red-300">{state.errors.acepto[0]}</p>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-linea bg-superficie p-5">
          <EtiquetaMono>Resumen</EtiquetaMono>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <Etiqueta htmlFor="codigoCupon">Código de descuento</Etiqueta>
              <input
                id="codigoCupon"
                name="codigoCupon"
                value={cupon}
                onChange={(e) => {
                  setCupon(e.target.value.toUpperCase());
                  setEstadoCupon({ status: "idle" });
                }}
                placeholder="Si tienes uno"
                className={`${CLASE_CAMPO} uppercase`}
              />
            </div>
            <Boton
              type="button"
              variante="secundaria"
              disabled={comprobando || !cupon.trim()}
              onClick={() =>
                startComprobacion(async () => setEstadoCupon(await comprobarCupon(slug, cupon)))
              }
            >
              {comprobando ? "Comprobando…" : "Aplicar"}
            </Boton>
          </div>

          {estadoCupon.status === "valido" && (
            <p className="text-sm text-cian">
              Cupón válido: {estadoCupon.descripcion}. Se aplicará al confirmar
              {/* Un cupón se gasta una vez. Si se aplicara a cada miembro, una
                  familia de cuatro consumiría cuatro usos del mismo código. */}
              {personas > 1 ? ", sobre tu inscripción." : "."}
            </p>
          )}
          {estadoCupon.status === "invalido" && (
            <p className="text-sm text-red-300">{estadoCupon.message}</p>
          )}

          {/* Una línea por persona. Antes esto era una sola cifra —la del
              titular— así que una familia de tres leía «L 450.00» y pagaba
              1.050 sin enterarse hasta el momento de transferir. */}
          <div className="flex flex-col gap-2 border-t border-linea pt-4">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="min-w-0 truncate text-atenuado">
                {perfil.nombres || "Tú"}
                {seleccionada && (
                  <span className="text-mudo"> · {seleccionada.nombre}</span>
                )}
              </span>
              <span className="tabular shrink-0 font-mono text-texto">
                {seleccionada ? formatPrecio(Number(seleccionada.precio_vigente), moneda) : "—"}
              </span>
            </div>

            {acompanantes.map((a) => (
              <div key={a.id} className="flex items-baseline justify-between gap-4 text-sm">
                <span className="min-w-0 truncate text-atenuado">
                  {a.nombre}
                  {a.categoria && <span className="text-mudo"> · {a.categoria}</span>}
                </span>
                <span className="tabular shrink-0 font-mono text-texto">
                  {formatPrecio(a.precio, moneda)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-end justify-between gap-4 border-t border-linea pt-4">
            <span className="text-sm text-atenuado">
              {personas === 1 ? "Total" : `Total · ${personas} personas`}
            </span>
            <span className="tabular text-2xl font-extrabold tracking-display text-texto">
              {seleccionada ? formatPrecio(total, moneda) : "—"}
            </span>
          </div>

          <p className="font-mono text-xs text-mudo">
            {personas === 1
              ? "El pago se coordina con el organizador al confirmar la inscripción."
              : "Es un solo pago para todo el grupo. Al confirmarlo el organizador, se asignan los dorsales de todos."}
          </p>
        </div>
      </section>

      {state.status === "error" && state.message && (
        <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.message}</p>
      )}

      {/* Un único botón primario por paso, que es lo que pide la regla de oro. */}
      <div className="flex items-center justify-between gap-3">
        {pasoVisible > 0 ? (
          <Boton type="button" variante="fantasma" onClick={() => setPaso(pasoVisible - 1)}>
            ← Atrás
          </Boton>
        ) : (
          <span />
        )}
        {pasoVisible < PASOS.length - 1 ? (
          <Boton
            type="button"
            variante="primaria"
            tamano="lg"
            disabled={!categoriaId}
            onClick={() => setPaso(pasoVisible + 1)}
          >
            Continuar
          </Boton>
        ) : (
          <Boton
            type="submit"
            variante="primaria"
            tamano="lg"
            disabled={pending || !categoriaId || !firmado || !acepto}
          >
            {pending
              ? "Confirmando…"
              : seleccionada
                ? `Confirmar · ${formatPrecio(total, moneda)}`
                : "Confirmar inscripción"}
          </Boton>
        )}
      </div>
    </form>
  );
}
