"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CLASE_CAMPO } from "@/components/ui/Campo";

type Opcion = { id: string; nombre: string };

export function SelectorGeografico({
  paises,
  paisInicial,
  departamentoInicial,
  ciudadInicial,
}: {
  paises: Opcion[];
  paisInicial?: string | null;
  departamentoInicial?: string | null;
  ciudadInicial?: string | null;
}) {
  const [paisId, setPaisId] = useState(paisInicial ?? "");
  const [departamentoId, setDepartamentoId] = useState(departamentoInicial ?? "");
  const [ciudadId, setCiudadId] = useState(ciudadInicial ?? "");

  // Se guarda junto a la clave que originó la carga: así el listado se descarta
  // solo al renderizar cuando cambia el padre, sin limpiar estado dentro del efecto.
  const [cacheDeps, setCacheDeps] = useState<{ para: string; items: Opcion[] }>({ para: "", items: [] });
  const [cacheCiudades, setCacheCiudades] = useState<{ para: string; items: Opcion[] }>({
    para: "",
    items: [],
  });

  const departamentos = cacheDeps.para === paisId ? cacheDeps.items : [];
  const ciudades = cacheCiudades.para === departamentoId ? cacheCiudades.items : [];

  useEffect(() => {
    if (!paisId) return;
    let cancelado = false;
    createClient()
      .from("departamentos")
      .select("id, nombre")
      .eq("pais_id", paisId)
      .order("nombre")
      .then(({ data }) => !cancelado && setCacheDeps({ para: paisId, items: data ?? [] }));
    return () => {
      cancelado = true;
    };
  }, [paisId]);

  useEffect(() => {
    if (!departamentoId) return;
    let cancelado = false;
    createClient()
      .from("ciudades")
      .select("id, nombre")
      .eq("departamento_id", departamentoId)
      .order("nombre")
      .then(({ data }) => !cancelado && setCacheCiudades({ para: departamentoId, items: data ?? [] }));
    return () => {
      cancelado = true;
    };
  }, [departamentoId]);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="paisId" className="text-sm font-medium text-atenuado">
          País de residencia
        </label>
        <select
          id="paisId"
          name="paisId"
          value={paisId}
          onChange={(e) => {
            setPaisId(e.target.value);
            setDepartamentoId("");
            setCiudadId("");
          }}
          className={CLASE_CAMPO}
        >
          <option value="">Selecciona…</option>
          {paises.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="departamentoId" className="text-sm font-medium text-atenuado">
          Departamento
        </label>
        {/*
          El valor viaja en un campo oculto y no en el `select`. Un `<select
          disabled>` no entra en el FormData, así que mientras cargaba el
          catálogo —o si la consulta fallaba— el formulario enviaba el campo
          vacío y el guardado borraba la residencia que el corredor ya tenía.
          Separando ambas cosas, lo peor que puede pasar es que no cambie nada.
        */}
        <input type="hidden" name="departamentoId" value={departamentoId} />
        <select
          id="departamentoId"
          value={departamentoId}
          disabled={!departamentos.length}
          onChange={(e) => {
            setDepartamentoId(e.target.value);
            setCiudadId("");
          }}
          className={CLASE_CAMPO}
        >
          <option value="">{departamentos.length ? "Selecciona…" : "—"}</option>
          {departamentos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="ciudadId" className="text-sm font-medium text-atenuado">
          Ciudad / municipio
        </label>
        <input type="hidden" name="ciudadId" value={ciudadId} />
        <select
          id="ciudadId"
          value={ciudadId}
          disabled={!ciudades.length}
          onChange={(e) => setCiudadId(e.target.value)}
          className={CLASE_CAMPO}
        >
          <option value="">{ciudades.length ? "Selecciona…" : "—"}</option>
          {ciudades.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
