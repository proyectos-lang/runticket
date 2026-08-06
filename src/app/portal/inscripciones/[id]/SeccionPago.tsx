"use client";

import { useActionState } from "react";
import { formatPrecio } from "@/lib/format";
import { METODO_PAGO_LABEL } from "@/lib/pagos";
import { Aviso } from "@/components/ui/Aviso";
import { Boton } from "@/components/ui/Boton";
import { claseBoton } from "@/components/ui/estilosBoton";
import { EtiquetaMono } from "@/components/ui/Datos";
import { CLASE_CAMPO } from "@/components/ui/Campo";
import { subirComprobante, marcarPagoPorWhatsApp, type PagoState } from "./actions";
import type { EstadoPago, MetodoPago } from "@/lib/supabase/database.types";

const initialState: PagoState = { status: "idle" };

const BADGE: Record<EstadoPago, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente", clase: "border border-naranja/40 bg-naranja/14 text-naranja-suave" },
  en_verificacion: { texto: "En revisión", clase: "border border-naranja/40 bg-naranja/14 text-naranja-suave" },
  pagado: { texto: "Pagado", clase: "bg-texto/8 text-texto/75" },
  rechazado: { texto: "Rechazado", clase: "border border-red-500/40 bg-red-500/10 text-rojo" },
  reembolsado: { texto: "Reembolsado", clase: "bg-texto/8 text-atenuado" },
  anulado: { texto: "Anulado", clase: "bg-texto/6 text-texto/50" },
};

/**
 * Bloque de pago con sus cuatro estados.
 *
 * **El naranja de esta pantalla vive aquí solo mientras haya algo que pagar.**
 * Cuando el pago está confirmado el bloque se colapsa a su cabecera y no ofrece
 * ninguna acción, para que el naranja pase al CTA de retiro del kit. Nunca
 * pueden estar los dos a la vez.
 */
export function SeccionPago({
  inscripcionId,
  monto,
  moneda,
  pago,
  enlaceWa,
  urlComprobante,
  verificadoEn,
}: {
  inscripcionId: string;
  monto: number;
  moneda: string;
  pago: {
    estado: EstadoPago;
    metodo: MetodoPago;
    referencia_externa: string | null;
    notas: string | null;
  } | null;
  enlaceWa: string | null;
  urlComprobante: string | null;
  verificadoEn?: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    subirComprobante.bind(null, inscripcionId),
    initialState
  );

  const estado: EstadoPago = pago?.estado ?? "pendiente";
  const pagado = estado === "pagado";
  const enRevision = estado === "en_verificacion";
  const rechazado = estado === "rechazado";
  const badge = BADGE[estado];

  return (
    <section
      className={`flex flex-col gap-4 rounded-xl border bg-superficie-2 px-5 py-4.5 ${
        pagado ? "border-linea" : "border-naranja/30"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <EtiquetaMono>Importe</EtiquetaMono>
          <span className="tabular text-3xl font-extrabold tracking-display-fuerte text-texto">
            {formatPrecio(monto, moneda)}
          </span>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.75 py-1.5 font-mono text-[0.59375rem] font-bold uppercase tracking-etiqueta ${badge.clase}`}
        >
          {badge.texto}
        </span>
      </div>

      {pago && (
        <p className="tabular font-mono text-[0.65625rem] uppercase tracking-etiqueta text-mudo">
          {METODO_PAGO_LABEL[pago.metodo]}
          {pago.referencia_externa && ` · Ref. ${pago.referencia_externa}`}
        </p>
      )}

      {pagado ? (
        <Aviso tono="verde" titulo="El organizador confirmó tu pago">
          Tu plaza está asegurada
          {verificadoEn &&
            ` desde el ${new Intl.DateTimeFormat("es-HN", { dateStyle: "long" }).format(new Date(verificadoEn))}`}
          . El dorsal se genera automáticamente.
        </Aviso>
      ) : (
        <>
          {enRevision && (
            <Aviso tono="ambar" titulo="Recibimos tu comprobante">
              El organizador lo está revisando. Te avisamos en cuanto lo confirme.
            </Aviso>
          )}
          {rechazado && (
            <Aviso tono="rojo" titulo="El organizador rechazó el comprobante">
              {pago?.notas ?? "No indicó el motivo."} Puedes subir otro más abajo.
            </Aviso>
          )}

          <div className="flex flex-col gap-5">
            {enlaceWa && (
              <div className="flex flex-col gap-2 border-t border-linea pt-4">
                <EtiquetaMono>Opción 1 · Coordinar por WhatsApp</EtiquetaMono>
                <p className="text-[0.78125rem] leading-relaxed text-atenuado">
                  Se abre WhatsApp con la referencia, la carrera, tu categoría y el monto ya
                  escritos.
                </p>
                <a
                  href={enlaceWa}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    // Deja constancia del intento sin bloquear la apertura de WhatsApp.
                    void marcarPagoPorWhatsApp(inscripcionId);
                  }}
                  className={claseBoton("primaria", "md", "mt-1 self-start")}
                >
                  Escribir al organizador
                </a>
              </div>
            )}

            {/* En revisión no se ofrece volver a subir: el comprobante ya está
                en manos del organizador y duplicarlo solo genera trabajo. */}
            {!enRevision && (
              <form action={formAction} className="flex flex-col gap-3 border-t border-linea pt-4">
                <EtiquetaMono>
                  Opción {enlaceWa ? "2" : "1"} · Subir comprobante de transferencia
                </EtiquetaMono>
                <input
                  type="file"
                  name="comprobante"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  required
                  className="rounded-md border border-dashed border-texto/20 px-3.5 py-3 text-sm text-atenuado"
                />
                <input
                  type="text"
                  name="referencia"
                  placeholder="N.º de referencia (opcional)"
                  className={`${CLASE_CAMPO} font-mono sm:max-w-56`}
                />
                <Boton
                  type="submit"
                  variante="secundaria"
                  disabled={pending}
                  className="self-start"
                >
                  {pending ? "Enviando…" : "Enviar comprobante"}
                </Boton>

                {state.status === "error" && <p className="text-sm text-rojo">{state.message}</p>}
                {state.status === "enviado" && (
                  <p className="text-sm text-cian">
                    Comprobante enviado. Te avisaremos cuando lo verifiquen.
                  </p>
                )}
              </form>
            )}
          </div>
        </>
      )}

      {urlComprobante && (
        <a
          href={urlComprobante}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start font-mono text-[0.65625rem] uppercase tracking-etiqueta text-cian underline underline-offset-2 hover:text-texto"
        >
          Ver el comprobante que envié
        </a>
      )}
    </section>
  );
}
