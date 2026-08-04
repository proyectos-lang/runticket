import QRCode from "qrcode";
import { distanciaSiAporta } from "@/lib/format";
import { EtiquetaMono } from "@/components/ui/Datos";

export type EstadoRetiro = "listo" | "retirado" | "sin_dorsal";

/**
 * Código de retiro con su QR. Es el elemento más grande de la pantalla porque
 * se usa en una tienda, con poca luz y con prisa.
 *
 * El QR se genera en el servidor como data URL: no hace falta arrastrar la
 * librería al cliente y no cambia entre renderizados.
 *
 * **La placa blanca no es decoración.** Un QR con módulos claros sobre fondo
 * oscuro falla en buena parte de los lectores, que asumen módulos oscuros y no
 * invierten. Va en negro sobre blanco con su zona de silencio, y junto al
 * lienzo de la firma es el único blanco autorizado del sistema.
 */
export async function TarjetaCodigoRetiro({
  eventoId,
  codigoQr,
  dorsal,
  talla,
  categoria,
  distanciaKm,
  estado,
  retiradoEn,
}: {
  eventoId: string;
  codigoQr: string;
  dorsal: number;
  talla: string | null;
  categoria: string;
  distanciaKm: number | null;
  estado: EstadoRetiro;
  retiradoEn?: string | null;
}) {
  const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // El contenido del QR es la misma URL que lee el escáner del organizador.
  // Cambiarlo por un código propio rompería el check-in que ya funciona.
  const url = `${sitio}/panel/eventos/${eventoId}/checkin?codigo=${codigoQr}`;
  const qr = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "Q",
    margin: 2,
    width: 640,
    color: { dark: "#07080a", light: "#ffffff" },
  });

  const retirado = estado === "retirado";
  const linea = [talla && `Talla ${talla}`, categoria, distanciaSiAporta(categoria, distanciaKm)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={`relative flex flex-col items-center gap-4 rounded-xl p-5 text-center ${
        retirado ? "border border-linea bg-superficie" : "border border-naranja/32"
      }`}
      style={
        retirado
          ? undefined
          : { background: "linear-gradient(140deg, rgba(255,106,26,.14), rgba(47,107,255,.12))" }
      }
    >
      <EtiquetaMono>Código de retiro</EtiquetaMono>

      <div className="relative">
        <div className={`rounded-[0.625rem] bg-white p-2 ${retirado ? "opacity-35" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL generado
              aquí mismo; el optimizador de Next no puede procesarlo. */}
          <img
            src={qr}
            alt="Código QR de tu inscripción"
            width={166}
            height={166}
            className="size-[10.375rem]"
          />
        </div>
        {retirado && (
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-cian/15 px-3 py-1.5 font-mono text-[0.6875rem] font-bold uppercase tracking-etiqueta text-cian">
            Retirado
            {retiradoEn &&
              ` · ${new Intl.DateTimeFormat("es-HN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(retiradoEn)).replace(/\./g, "").toUpperCase()}`}
          </span>
        )}
      </div>

      {/* Respaldo si el QR no lee: el operador puede buscar por número de dorsal. */}
      <div className="flex flex-col gap-1">
        <p className="tabular font-mono text-xl font-extrabold tracking-etiqueta text-texto">
          RT-{dorsal}
        </p>
        <p className="font-mono text-[0.625rem] uppercase tracking-etiqueta text-texto/40">
          Si el código no lee, di tu dorsal: {dorsal}
        </p>
      </div>

      {linea && (
        <p className="w-full border-t border-texto/10 pt-3.5 font-mono text-[0.65625rem] font-medium uppercase tracking-etiqueta text-texto/50">
          {linea}
        </p>
      )}
    </div>
  );
}
