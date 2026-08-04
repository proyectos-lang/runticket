import QRCode from "qrcode";
import { EtiquetaMono } from "@/components/ui/Datos";

/**
 * Dorsal digital con su QR.
 *
 * El QR se genera en el servidor como data URL: es la única forma de tenerlo
 * sin arrastrar la librería al cliente, y no cambia entre renderizados.
 *
 * **La placa clara bajo el QR no es decoración.** Un QR con módulos claros
 * sobre fondo oscuro falla en buena parte de los lectores —muchos asumen
 * módulos oscuros y no invierten—, así que va en negro sobre blanco con su zona
 * de silencio. Junto al lienzo de la firma, es el único blanco autorizado del
 * sistema.
 */
export async function TarjetaDorsal({
  numeroDorsal,
  codigoQr,
  eventoId,
  evento,
  categoria,
  talla,
}: {
  numeroDorsal: number;
  codigoQr: string;
  eventoId: string;
  evento: string;
  categoria: string;
  talla: string | null;
}) {
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const url = `${sitio}/panel/eventos/${eventoId}/checkin?codigo=${codigoQr}`;
  // Corrección alta y margen de 1 módulo: se lee desde la pantalla de un
  // teléfono, a veces con poca luz y con brillo bajo.
  const qr = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "Q",
    margin: 1,
    width: 512,
    color: { dark: "#07080a", light: "#ffffff" },
  });

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border border-naranja/32 p-6 sm:flex-row sm:items-center"
      style={{
        background:
          "linear-gradient(140deg, rgba(255,106,26,.14), rgba(47,107,255,.12))",
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <EtiquetaMono>Dorsal digital</EtiquetaMono>
        <p className="tabular text-6xl font-black leading-none tracking-display-fuerte text-texto">
          {numeroDorsal}
        </p>
        <p className="mt-1 truncate font-semibold text-naranja-suave">{evento}</p>
        <p className="font-mono text-xs uppercase tracking-etiqueta text-texto/40">
          {categoria}
          {talla && ` · Talla ${talla}`}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-2">
        <div className="rounded-xl bg-white p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- es un data URL
              generado aquí mismo: el optimizador de Next no puede procesarlo. */}
          <img src={qr} alt="Código QR de tu inscripción" width={130} height={130} />
        </div>
        <span className="font-mono text-[0.6875rem] uppercase tracking-etiqueta text-texto/40">
          Escanea para tu kit
        </span>
      </div>
    </div>
  );
}
