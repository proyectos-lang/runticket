import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { trayectoriaDelCorredor } from "@/lib/portal/trayectoria";
import { formatFechaMono, distanciaSiAporta } from "@/lib/format";
import { EncabezadoSeccion } from "@/components/portal/Historial";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mis certificados | RunTicket",
  robots: { index: false },
};

export default async function CertificadosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const t = await trayectoriaDelCorredor(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/portal"
          className="font-mono text-xs uppercase tracking-etiqueta text-mudo transition-colors hover:text-texto"
        >
          ← Mi perfil
        </Link>
        <h1 className="display text-2xl text-texto">Certificados</h1>
      </div>

      <section className="flex flex-col gap-2.5">
        <EncabezadoSeccion>Carreras finalizadas</EncabezadoSeccion>

        {t.finalizadas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-linea-fuerte px-6 py-10 text-center text-sm text-atenuado">
            Tus certificados aparecerán aquí cuando corras tu primera carrera.
          </p>
        ) : (
          t.finalizadas.map((c) => (
            <div
              key={c.inscripcionId}
              className={`flex items-center justify-between gap-3 rounded-xl border border-linea bg-superficie px-4 py-3.5 ${
                c.tieneCertificado ? "" : "opacity-60"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-texto">
                  {c.evento}
                  {distanciaSiAporta(c.categoria, c.distanciaKm) &&
                    ` ${distanciaSiAporta(c.categoria, c.distanciaKm)}`}
                </p>
                <p className="tabular truncate font-mono text-[0.65625rem] uppercase tracking-etiqueta text-texto/45">
                  {formatFechaMono(c.fecha, c.zonaHoraria)}
                </p>
              </div>

              {c.tieneCertificado ? (
                <a
                  href={`/portal/inscripciones/${c.inscripcionId}/certificado.pdf`}
                  className="flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-naranja transition-colors hover:bg-naranja/10"
                >
                  <span className="rounded-[0.3125rem] bg-naranja/12 px-2 py-1 font-mono text-[0.59375rem] font-bold uppercase tracking-etiqueta">
                    PDF
                  </span>
                  <span aria-hidden className="text-[1.0625rem] font-extrabold">
                    ↓
                  </span>
                  <span className="sr-only">Descargar certificado de {c.evento}</span>
                </a>
              ) : (
                // No se ofrece una descarga que va a fallar: el certificado
                // depende de que el organizador publique los resultados.
                <span className="shrink-0 whitespace-nowrap font-mono text-[0.59375rem] uppercase tracking-etiqueta text-texto/40">
                  Pendiente de publicación
                </span>
              )}
            </div>
          ))
        )}
      </section>

      <p className="text-xs text-mudo">
        La declaración de salud firmada y el comprobante de pago se descargan desde la ficha de
        cada inscripción.
      </p>
    </div>
  );
}
