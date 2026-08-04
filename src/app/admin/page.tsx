import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPrecio, formatFechaCorta } from "@/lib/format";
import { TarjetaMetricaPanel } from "@/components/panel/Medidores";
import { AreaTemporal, BarrasHorizontales } from "@/components/metricas/Graficos";
import type { MetricasPlataforma } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

export default async function AdminInicioPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("metricas_plataforma");
  const m = (data ?? {}) as Partial<MetricasPlataforma>;

  const porMes = Object.entries(m.inscripciones_por_mes ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, valor]) => ({ etiqueta: formatFechaCorta(`${mes}-01`), valor }));

  const topEmpresas = (m.top_empresas ?? []).map((e) => ({
    etiqueta: e.empresa,
    valor: e.inscripciones,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-texto">Panel de plataforma</h1>
        <p className="text-sm text-atenuado">
          Consolidado de todas las empresas organizadoras.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaMetricaPanel
          label="Empresas activas" valor={m.empresas_activas ?? 0}
          nota={m.empresas_suspendidas ? `${m.empresas_suspendidas} suspendidas` : undefined}
        />
        <TarjetaMetricaPanel
          label="Eventos publicados" valor={m.eventos_publicados ?? 0}
          nota={`${m.eventos_totales ?? 0} en total`}
        />
        <TarjetaMetricaPanel
          label="Inscripciones activas" valor={m.inscripciones_activas ?? 0}
          nota={`${m.corredores ?? 0} corredores distintos`}
        />
        <TarjetaMetricaPanel
          label="Recaudado" valor={formatPrecio(Number(m.recaudado ?? 0), "HNL")}
          nota={`${formatPrecio(Number(m.pendiente_cobro ?? 0), "HNL")} por cobrar`}
        />
      </div>

      <section className="rounded-2xl border p-6 border-linea bg-superficie">
        <h2 className="mb-1 text-lg font-semibold text-texto">
          Inscripciones por mes
        </h2>
        <p className="mb-4 text-sm text-atenuado">Últimos 12 meses.</p>
        {porMes.length ? (
          <AreaTemporal datos={porMes} />
        ) : (
          <p className="py-8 text-center text-sm text-atenuado">
            Todavía no hay inscripciones.
          </p>
        )}
      </section>

      <section className="rounded-2xl border p-6 border-linea bg-superficie">
        <h2 className="mb-4 text-lg font-semibold text-texto">
          Empresas con más inscripciones
        </h2>
        {topEmpresas.length ? (
          <BarrasHorizontales datos={topEmpresas} unidad="inscripciones" />
        ) : (
          <p className="py-8 text-center text-sm text-atenuado">Sin datos aún.</p>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        {[
          { href: "/admin/empresas", texto: "Gestionar empresas" },
          { href: "/admin/usuarios", texto: "Usuarios" },
          { href: "/admin/auditoria", texto: "Bitácora" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-full border px-4 py-2 text-sm font-medium border-linea-fuerte text-atenuado hover:bg-superficie-2"
          >
            {l.texto}
          </Link>
        ))}
      </div>
    </div>
  );
}
