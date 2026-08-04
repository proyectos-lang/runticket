"use client";

import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useTransition } from "react";
import { ESTADO_PAGO_LABEL } from "@/lib/pagos";

const claseCampo =
  "rounded-lg border px-3 py-2 text-sm outline-none focus:border-texto/25 border-linea-fuerte bg-superficie text-texto";

export function FiltrosInscritos({
  categorias,
  tallas,
  mostrarPago,
}: {
  categorias: { id: string; nombre: string }[];
  tallas: string[];
  mostrarPago: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { id } = useParams<{ id: string }>();
  const [pendiente, startTransition] = useTransition();

  function actualizar(clave: string, valor: string) {
    const nuevos = new URLSearchParams(params.toString());
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    startTransition(() => router.push(`/panel/eventos/${id}/inscritos?${nuevos.toString()}`));
  }

  return (
    <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-5 ${pendiente ? "opacity-60" : ""}`}>
      <input
        type="search"
        placeholder="Nombre, correo o dorsal"
        defaultValue={params.get("q") ?? ""}
        onChange={(e) => actualizar("q", e.target.value)}
        className={claseCampo}
        aria-label="Buscar inscrito"
      />
      <select
        defaultValue={params.get("categoria") ?? ""}
        onChange={(e) => actualizar("categoria", e.target.value)}
        className={claseCampo}
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
        defaultValue={params.get("talla") ?? ""}
        onChange={(e) => actualizar("talla", e.target.value)}
        className={claseCampo}
        aria-label="Filtrar por talla"
      >
        <option value="">Todas las tallas</option>
        {tallas.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        defaultValue={params.get("sexo") ?? ""}
        onChange={(e) => actualizar("sexo", e.target.value)}
        className={claseCampo}
        aria-label="Filtrar por género"
      >
        <option value="">Cualquier género</option>
        <option value="femenino">Femenino</option>
        <option value="masculino">Masculino</option>
        <option value="otro">Otro</option>
      </select>
      {mostrarPago && (
        <select
          defaultValue={params.get("pago") ?? ""}
          onChange={(e) => actualizar("pago", e.target.value)}
          className={claseCampo}
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
    </div>
  );
}
