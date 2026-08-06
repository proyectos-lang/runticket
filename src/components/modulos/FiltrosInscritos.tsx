"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ESTADO_PAGO_LABEL } from "@/lib/pagos";
import { RANGOS_EDAD } from "@/lib/edades";
import { CLASE_CAMPO } from "@/components/ui/Campo";
import type { CatalogoInscritos } from "@/lib/eventos/inscritos";

/** Un solo sitio donde se dice qué claves de la URL son filtros. */
const CLAVES = [
  "q",
  "evento",
  "categoria",
  "talla",
  "sexo",
  "pago",
  "kit",
  "asistencia",
  "edad",
  "dorsal",
] as const;

export function FiltrosInscritos({
  catalogo,
  mostrarPago,
  mostrarCarrera,
}: {
  catalogo: CatalogoInscritos;
  mostrarPago: boolean;
  /** Solo en la vista de todas las carreras: dentro de una, sobra. */
  mostrarCarrera: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendiente, startTransition] = useTransition();

  function navegar(nuevos: URLSearchParams) {
    const cadena = nuevos.toString();
    startTransition(() => router.push(cadena ? `${pathname}?${cadena}` : pathname));
  }

  function actualizar(clave: string, valor: string) {
    const nuevos = new URLSearchParams(params.toString());
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    navegar(nuevos);
  }

  /**
   * La búsqueda espera a que se deje de teclear.
   *
   * Cada cambio de filtro es una navegación con render en el servidor. Sin esta
   * espera, escribir «Hernández» lanzaba nueve consultas al padrón entero y las
   * respuestas llegaban desordenadas.
   */
  const [texto, setTexto] = useState(params.get("q") ?? "");
  const primerRender = useRef(true);

  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    const t = setTimeout(() => actualizar("q", texto.trim()), 300);
    return () => clearTimeout(t);
    // `actualizar` se recrea en cada render; lo que debe disparar esto es el texto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  // Con una carrera elegida en el filtro, solo sus categorías tienen sentido.
  const eventoFiltrado = params.get("evento");
  const categorias = eventoFiltrado
    ? catalogo.categorias.filter((c) => c.eventoId === eventoFiltrado)
    : catalogo.categorias;

  const activos = CLAVES.filter((c) => params.get(c));
  const clase = `${CLASE_CAMPO} h-10 text-[0.8125rem]`;

  return (
    <div className={`flex flex-col gap-3 ${pendiente ? "opacity-60" : ""}`}>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Nombre, dorsal, documento o club"
          className={`${clase} lg:col-span-2`}
          aria-label="Buscar inscrito"
        />

        {mostrarCarrera && (
          <select
            value={eventoFiltrado ?? ""}
            onChange={(e) => {
              // Al cambiar de carrera se suelta la categoría: la que estuviera
              // elegida es de otra y dejaría la tabla vacía sin explicar por qué.
              const nuevos = new URLSearchParams(params.toString());
              if (e.target.value) nuevos.set("evento", e.target.value);
              else nuevos.delete("evento");
              nuevos.delete("categoria");
              navegar(nuevos);
            }}
            className={clase}
            aria-label="Filtrar por carrera"
          >
            <option value="">Todas las carreras</option>
            {catalogo.eventos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        )}

        <select
          value={params.get("categoria") ?? ""}
          onChange={(e) => actualizar("categoria", e.target.value)}
          className={clase}
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        <select
          value={params.get("talla") ?? ""}
          onChange={(e) => actualizar("talla", e.target.value)}
          className={clase}
          aria-label="Filtrar por talla"
        >
          <option value="">Todas las tallas</option>
          {catalogo.tallas.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          value={params.get("sexo") ?? ""}
          onChange={(e) => actualizar("sexo", e.target.value)}
          className={clase}
          aria-label="Filtrar por género"
        >
          <option value="">Cualquier género</option>
          <option value="femenino">Femenino</option>
          <option value="masculino">Masculino</option>
          <option value="otro">Otro</option>
        </select>

        <select
          value={params.get("edad") ?? ""}
          onChange={(e) => actualizar("edad", e.target.value)}
          className={clase}
          aria-label="Filtrar por rango de edad"
        >
          <option value="">Cualquier edad</option>
          {RANGOS_EDAD.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        {mostrarPago && (
          <select
            value={params.get("pago") ?? ""}
            onChange={(e) => actualizar("pago", e.target.value)}
            className={clase}
            aria-label="Filtrar por estado de pago"
          >
            <option value="">Cualquier pago</option>
            <option value="sin_pago">Sin registrar</option>
            {Object.entries(ESTADO_PAGO_LABEL).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        )}

        <select
          value={params.get("kit") ?? ""}
          onChange={(e) => actualizar("kit", e.target.value)}
          className={clase}
          aria-label="Filtrar por entrega de kit"
        >
          <option value="">Kit: cualquiera</option>
          <option value="entregado">Kit entregado</option>
          <option value="pendiente">Kit pendiente</option>
        </select>

        <select
          value={params.get("asistencia") ?? ""}
          onChange={(e) => actualizar("asistencia", e.target.value)}
          className={clase}
          aria-label="Filtrar por asistencia"
        >
          <option value="">Asistencia: cualquiera</option>
          <option value="presente">Presentes</option>
          <option value="ausente">Sin marcar</option>
        </select>

        <select
          value={params.get("dorsal") ?? ""}
          onChange={(e) => actualizar("dorsal", e.target.value)}
          className={clase}
          aria-label="Filtrar por dorsal asignado"
        >
          <option value="">Dorsal: cualquiera</option>
          <option value="con">Con dorsal</option>
          <option value="sin">Sin dorsal</option>
        </select>
      </div>

      {activos.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setTexto("");
            navegar(new URLSearchParams());
          }}
          className="self-start font-mono text-[0.65625rem] uppercase tracking-etiqueta text-cian hover:underline"
        >
          Quitar los {activos.length} filtros activos
        </button>
      )}
    </div>
  );
}
