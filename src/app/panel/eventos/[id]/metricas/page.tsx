import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEmpresaActivaDelPanel } from "@/lib/auth/session";
import { formatPrecio, formatFechaCorta } from "@/lib/format";
import type { MetricasEvento, ConciliacionEvento, NpsEvento } from "@/lib/supabase/database.types";
import { BarrasVerticales, BarrasHorizontales, AreaTemporal, type Punto } from "@/components/metricas/Graficos";
import { Tarjeta, TablaDatos } from "@/components/metricas/Tarjetas";
import { RangoFechas } from "@/components/metricas/RangoFechas";
import { BloqueRecurrencia } from "@/components/metricas/Recurrencia";
import { BloqueNps } from "@/components/metricas/Nps";
import { MedidorOcupacion } from "@/components/panel/Medidores";

const ORDEN_EDAD = ["Menor de 18", "18-29", "30-39", "40-49", "50-59", "60 o más"];
const ORDEN_TALLA = ["XS", "S", "M", "L", "XL", "XXL"];
const ORDEN_EXPERIENCIA = ["principiante", "intermedio", "avanzado", "competitivo"];
const ETIQUETA_SEXO: Record<string, string> = {
  femenino: "Femenino",
  masculino: "Masculino",
  otro: "Otro",
  sin_dato: "Sin dato",
};

/** Convierte el objeto {clave: n} en puntos, respetando un orden si se indica. */
function aPuntos(registro: Record<string, number>, orden?: string[], etiquetas?: Record<string, string>): Punto[] {
  const entradas = Object.entries(registro ?? {});
  const puntos = entradas.map(([clave, valor]) => ({
    etiqueta: etiquetas?.[clave] ?? clave.charAt(0).toUpperCase() + clave.slice(1).replace(/_/g, " "),
    clave,
    valor,
  }));
  if (orden) {
    puntos.sort((a, b) => {
      const ia = orden.indexOf(a.clave);
      const ib = orden.indexOf(b.clave);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  } else {
    puntos.sort((a, b) => b.valor - a.valor);
  }
  return puntos.map(({ etiqueta, valor }) => ({ etiqueta, valor }));
}

/** Acepta solo `AAAA-MM-DD`: lo que llegue torcido por la URL se ignora. */
function fechaValida(valor?: string): string | null {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null;
}

export default async function MetricasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { id } = await params;
  const { desde: desdeParam, hasta: hastaParam } = await searchParams;
  const membresia = await getEmpresaActivaDelPanel();
  if (membresia.rol !== "admin_empresa") redirect(`/panel/eventos/${id}`);

  // Invertidas se corrigen en vez de devolver cero filas sin explicación.
  const a = fechaValida(desdeParam);
  const b = fechaValida(hastaParam);
  const [desde, hasta] = a && b && a > b ? [b, a] : [a, b];

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select("id, nombre, slug, moneda")
    .eq("id", id)
    .eq("empresa_id", membresia.empresaId)
    .maybeSingle();
  if (!evento) notFound();

  // Las dos agregaciones bajan a Postgres y comparten el mismo rango, para que
  // las cifras de arriba y las de abajo no hablen de periodos distintos.
  const [{ data: metricasRaw }, { data: conciliacionRaw }, { data: npsRaw }] = await Promise.all([
    supabase.rpc("metricas_evento", { p_evento_id: id, p_desde: desde, p_hasta: hasta }),
    supabase.rpc("conciliacion_evento", { p_evento_id: id, p_desde: desde, p_hasta: hasta }),
    // La encuesta queda fuera del rango a propósito: se responde después de la
    // carrera y acotarla por fecha de inscripción la dejaría casi siempre vacía.
    supabase.rpc("nps_evento", { p_evento_id: id }),
  ]);

  const m = (metricasRaw ?? {}) as Partial<MetricasEvento>;
  const conc = (conciliacionRaw ?? {}) as Partial<ConciliacionEvento>;
  const inscritos = m.inscritos ?? 0;

  // Conversión por inscripción, no por pago: un pago familiar cubre a varias
  // personas y contarlo como uno hundía la tasa.
  const pagadas = conc.inscripciones_pagadas ?? 0;
  const conversion = inscritos > 0 ? Math.round((pagadas / inscritos) * 100) : 0;

  const edad = aPuntos(m.por_rango_edad ?? {}, ORDEN_EDAD);
  const sexo = aPuntos(m.por_sexo ?? {}, undefined, ETIQUETA_SEXO);
  const talla = aPuntos(m.por_talla ?? {}, ORDEN_TALLA);
  const experiencia = aPuntos(m.por_experiencia ?? {}, ORDEN_EXPERIENCIA);
  const origen = aPuntos(m.por_origen ?? {});
  const ciudad = aPuntos(m.por_ciudad ?? {});
  const nacionalidad = aPuntos(m.por_nacionalidad ?? {});
  const r = m.recurrencia ?? { corredores: 0, recurrentes: 0, nuevos: 0 };
  const recurrencia = { total: r.corredores, recurrentes: r.recurrentes, nuevos: r.nuevos };
  const nps: NpsEvento = {
    respuestas: 0,
    invitados: 0,
    promotores: 0,
    pasivos: 0,
    detractores: 0,
    nps: null,
    promedio: null,
    comentarios: [],
    ...((npsRaw ?? {}) as Partial<NpsEvento>),
  };
  const porDia = Object.entries(m.inscripciones_por_dia ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, valor]) => ({ etiqueta: formatFechaCorta(dia), valor }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {/* La vuelta la pone la cabecera del evento. */}
          <h1 className="text-2xl font-semibold text-texto">Métricas</h1>
        </div>
        <a
          href={`/panel/eventos/${evento.id}/inscritos/exportar.xlsx`}
          className="rounded-full border px-4 py-2 text-sm font-medium border-linea-fuerte text-atenuado hover:bg-superficie-2"
        >
          Exportar inscritos
        </a>
      </div>

      <Suspense fallback={null}>
        <RangoFechas desde={desde} hasta={hasta} />
      </Suspense>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta etiqueta="Inscritos" valor={inscritos} detalle={`${m.anuladas ?? 0} anuladas`} />
        <Tarjeta
          etiqueta="Conversión de pago"
          valor={`${conversion}%`}
          detalle={`${pagadas} de ${inscritos} pagadas`}
        />
        <Tarjeta
          etiqueta="Recaudado"
          valor={formatPrecio(Number(conc.total_pagado ?? 0), evento.moneda)}
          detalle={`${formatPrecio(Number(conc.total_pendiente ?? 0), evento.moneda)} pendiente`}
        />
        <Tarjeta
          etiqueta="Kits entregados"
          valor={m.kits_entregados ?? 0}
          detalle={inscritos ? `${Math.round(((m.kits_entregados ?? 0) / inscritos) * 100)}% del total` : undefined}
        />
      </div>

      <BloqueRecurrencia datos={recurrencia} />

      <BloqueNps datos={nps} />

      <section className="rounded-2xl border p-6 border-linea bg-superficie">
        <h2 className="mb-4 text-lg font-semibold text-texto">
          Ocupación de cupos por categoría
        </h2>
        {m.por_categoria?.length ? (
          <div className="flex flex-col gap-4">
            {m.por_categoria.map((c) => (
              <MedidorOcupacion key={c.categoria} etiqueta={c.categoria} ocupado={c.inscritos} total={c.cupo} grosor={8} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-atenuado">Sin categorías configuradas.</p>
        )}
      </section>

      <section className="rounded-2xl border p-6 border-linea bg-superficie">
        <h2 className="mb-1 text-lg font-semibold text-texto">
          Inscripciones por día
        </h2>
        <p className="mb-4 text-sm text-atenuado">
          Útil para ver el efecto de las promociones y del cierre de plazo.
        </p>
        {porDia.length ? <AreaTemporal datos={porDia} /> : <SinDatos />}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel titulo="Rango de edad" datos={edad}>
          <BarrasVerticales datos={edad} />
        </Panel>
        <Panel titulo="Género" datos={sexo}>
          <BarrasVerticales datos={sexo} />
        </Panel>
        <Panel titulo="Demanda por talla" datos={talla} columna="Prendas">
          <BarrasVerticales datos={talla} unidad="prendas" />
        </Panel>
        <Panel titulo="Nivel de experiencia" datos={experiencia}>
          <BarrasVerticales datos={experiencia} />
        </Panel>
        <Panel titulo="Cómo se enteraron" datos={origen}>
          <BarrasHorizontales datos={origen} />
        </Panel>
        <Panel titulo="Ciudad de residencia" datos={ciudad}>
          <BarrasHorizontales datos={ciudad} />
        </Panel>
        <Panel titulo="Nacionalidad" datos={nacionalidad}>
          <BarrasHorizontales datos={nacionalidad} />
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  titulo,
  datos,
  columna,
  children,
}: {
  titulo: string;
  datos: Punto[];
  columna?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border p-6 border-linea bg-superficie">
      <h2 className="mb-4 text-lg font-semibold text-texto">{titulo}</h2>
      {datos.length ? (
        <>
          {children}
          <div className="mt-3">
            <TablaDatos titulo={titulo} datos={datos} columna={columna} />
          </div>
        </>
      ) : (
        <SinDatos />
      )}
    </section>
  );
}

function SinDatos() {
  return (
    <p className="py-10 text-center text-sm text-atenuado">
      Todavía no hay datos suficientes.
    </p>
  );
}
