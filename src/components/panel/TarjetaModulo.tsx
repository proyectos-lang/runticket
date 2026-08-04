import Link from "next/link";
import { Icono, type NombreIcono } from "@/components/shell/iconos";
import { TituloSeccion } from "@/components/ui/Panel";

export type EstadoTarjeta = "ok" | "pendiente" | "neutro";

const TONO: Record<EstadoTarjeta, string> = {
  ok: "text-emerald-300",
  pendiente: "text-amber-300",
  neutro: "text-atenuado",
};

/**
 * Acceso a una sección del evento. Existe porque la navegación lateral no basta:
 * en pantallas de portátil los últimos módulos quedaban fuera de la vista y no
 * había ninguna otra puerta hacia ellos.
 */
export function TarjetaModulo({
  href,
  icono,
  titulo,
  detalle,
  estado = "neutro",
  descarga = false,
}: {
  href: string;
  icono: NombreIcono;
  titulo: string;
  detalle: string;
  estado?: EstadoTarjeta;
  /**
   * El destino es un archivo (CSV, PDF) y no una pantalla. Se renderiza como
   * ancla normal: `next/link` haría prefetch al pasar el ratón y obligaría al
   * servidor a generar el archivo entero sin que nadie lo haya pedido.
   */
  descarga?: boolean;
}) {
  const clase =
    "group flex items-start gap-3 rounded-2xl border border-linea bg-superficie p-5 transition-colors hover:border-linea-fuerte hover:bg-superficie-2";

  const contenido = (
    <>
      <span className="rounded-xl bg-superficie-2 p-2 text-mudo transition-colors group-hover:text-naranja">
        <Icono nombre={icono} className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-texto">{titulo}</span>
        <span className={`block text-sm ${TONO[estado]}`}>{detalle}</span>
      </span>
    </>
  );

  return descarga ? (
    <a href={href} className={clase}>
      {contenido}
    </a>
  ) : (
    <Link href={href} className={clase}>
      {contenido}
    </Link>
  );
}

export function GrupoTarjetas({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <TituloSeccion>{titulo}</TituloSeccion>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
