import Link from "next/link";
import Image from "next/image";
import {
  formatTiempo,
  formatRitmo,
  formatMesMono,
  formatFechaMono,
  distanciaSiAporta,
  formatPrecio,
} from "@/lib/format";
import { segundosDeIntervalo, type CarreraDelCorredor } from "@/lib/portal/trayectoria";
import { EtiquetaMono, PlaceholderMedia } from "@/components/ui/Datos";
import { BotonEnlace } from "@/components/ui/Boton";

/* ------------------------------------------------------------------------ */
/* Cabecera de identidad                                                     */
/* ------------------------------------------------------------------------ */

export function CabeceraPerfil({
  nombre,
  fotoUrl,
  ciudad,
  desdeAnio,
  club,
}: {
  nombre: string;
  fotoUrl?: string | null;
  ciudad?: string | null;
  desdeAnio: number | null;
  club: string | null;
}) {
  const meta = [ciudad, desdeAnio && `Desde ${desdeAnio}`].filter(Boolean).join(" · ");

  return (
    <header className="flex items-center gap-4 border-b border-linea px-6 pb-6 pt-7">
      <Link
        href="/portal/perfil"
        aria-label="Editar mi perfil"
        className="relative size-16 shrink-0 overflow-hidden rounded-full border-2 border-naranja"
      >
        {fotoUrl ? (
          <Image src={fotoUrl} alt="" fill sizes="66px" className="object-cover" />
        ) : (
          <PlaceholderMedia etiqueta="Foto" className="absolute inset-0" />
        )}
      </Link>

      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="truncate text-xl font-extrabold tracking-display text-texto">{nombre}</h1>
        {meta && (
          <p className="truncate font-mono text-[0.6875rem] uppercase tracking-etiqueta text-texto/45">
            {meta}
          </p>
        )}
        {/* Sin club el bloque colapsa: no se deja hueco reservado. */}
        {club && (
          <span className="mt-1 w-fit rounded-full border border-naranja/38 bg-naranja/13 px-2.5 py-1 font-mono text-[0.59375rem] font-bold uppercase tracking-etiqueta text-naranja-suave">
            {club}
          </span>
        )}
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------------ */
/* Tira de métricas                                                          */
/* ------------------------------------------------------------------------ */

export function TiraMetricas({
  metricas,
}: {
  metricas: { etiqueta: string; valor: string; destacado?: boolean }[];
}) {
  return (
    <div className="flex divide-x divide-linea border-b border-linea">
      {metricas.map((m) => (
        <div key={m.etiqueta} className="flex min-w-0 flex-1 flex-col gap-1 px-3 py-4 text-center">
          <span
            className={`tabular truncate text-2xl font-extrabold tracking-display ${
              m.destacado ? "text-cian" : "text-texto"
            }`}
          >
            {m.valor}
          </span>
          <span className="truncate font-mono text-[0.59375rem] uppercase tracking-etiqueta text-mudo">
            {m.etiqueta}
          </span>
        </div>
      ))}
    </div>
  );
}

export function EncabezadoSeccion({ children }: { children: React.ReactNode }) {
  return <EtiquetaMono className="block">{children}</EtiquetaMono>;
}

/* ------------------------------------------------------------------------ */
/* Estado de pago                                                            */
/* ------------------------------------------------------------------------ */

/**
 * El estado del pago en la línea mono de una fila.
 *
 * `pagado` va en el tono apagado y `pendiente` en naranja: lo que tiene que
 * saltar a la vista es lo que exige una acción, no lo que ya está resuelto.
 */
function textoDePago(carrera: CarreraDelCorredor) {
  if (carrera.estado === "lista_espera") return { texto: "En lista de espera", clase: "text-cian" };
  if (carrera.estado === "anulada") return { texto: "Cancelada", clase: "text-mudo" };
  if (carrera.estado === "transferida") return { texto: "Transferida", clase: "text-mudo" };
  if (carrera.estadoPago === "pagado") return { texto: "Pagado", clase: "text-texto/45" };
  if (carrera.estadoPago === "en_verificacion")
    return { texto: "Pago en revisión", clase: "text-naranja-suave" };
  return { texto: "Pago pendiente", clase: "text-naranja-suave" };
}

/**
 * Badge de estado de pago.
 *
 * Solo el pendiente lleva borde: es el único que reclama una acción, y el borde
 * lo separa del resto sin recurrir a otro color.
 */
export function BadgeEstadoPago({ carrera }: { carrera: CarreraDelCorredor }) {
  const anulada = carrera.estado === "anulada" || carrera.estado === "transferida";
  const { texto, tono } = anulada
    ? { texto: carrera.estado === "anulada" ? "Cancelado" : "Transferido", tono: "bg-texto/6 text-texto/50" }
    : carrera.estado === "lista_espera"
      ? { texto: "Lista de espera", tono: "border border-cian/36 bg-cian/12 text-cian" }
      : carrera.estadoPago === "pagado"
        ? { texto: "Pagado", tono: "bg-texto/8 text-texto/75" }
        : carrera.estadoPago === "en_verificacion"
          ? { texto: "En revisión", tono: "border border-naranja/40 bg-naranja/14 text-naranja-suave" }
          : carrera.estadoPago === "rechazado"
            ? { texto: "Rechazado", tono: "border border-red-500/40 bg-red-500/10 text-rojo" }
            : { texto: "Pendiente", tono: "border border-naranja/40 bg-naranja/14 text-naranja-suave" };

  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-2.75 py-1.5 font-mono text-[0.59375rem] font-bold uppercase tracking-etiqueta ${tono}`}
    >
      {texto}
    </span>
  );
}

/* ------------------------------------------------------------------------ */
/* Fila de próxima carrera                                                   */
/* ------------------------------------------------------------------------ */

export function FilaProxima({
  carrera,
  destacada = false,
}: {
  carrera: CarreraDelCorredor;
  /** Solo la más cercana lleva el borde naranja. */
  destacada?: boolean;
}) {
  const [dia, mes] = formatFechaMono(carrera.fecha, carrera.zonaHoraria).split(" ");
  const pago = textoDePago(carrera);

  // El kit solo se puede retirar con el pago confirmado y el dorsal asignado;
  // si falta algo, el destino es la ficha, donde se resuelve.
  const listoParaKit = carrera.estadoPago === "pagado" && carrera.dorsal !== null;
  const destino = listoParaKit
    ? `/portal/inscripciones/${carrera.inscripcionId}/kit`
    : `/portal/inscripciones/${carrera.inscripcionId}`;

  return (
    <Link
      href={destino}
      className={`flex items-center gap-3.5 rounded-xl border bg-superficie p-3.5 transition-colors ${
        destacada ? "border-naranja/28" : "border-linea hover:border-linea-fuerte"
      }`}
    >
      <div className="flex w-10 shrink-0 flex-col items-center">
        <span className="tabular text-lg font-extrabold leading-none tracking-display text-naranja-suave">
          {dia}
        </span>
        <span className="font-mono text-[0.5625rem] uppercase tracking-etiqueta text-texto/45">
          {mes}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 truncate text-sm font-bold text-texto">
          <span className="truncate">
            {carrera.evento}
            {carrera.categoria && ` ${carrera.categoria}`}
          </span>
          {/* Solo cuando corre otra persona: en las propias sería ruido, y sin
              esto no habría forma de saber cuál de las tres inscripciones de la
              familia es la de cada quien. */}
          {carrera.participante && (
            <span className="shrink-0 rounded-full border border-azul/36 bg-azul/14 px-2 py-0.5 font-mono text-[0.5625rem] font-bold uppercase tracking-etiqueta text-azul-texto">
              {carrera.participante.split(" ")[0]}
            </span>
          )}
        </p>
        <p
          className={`tabular truncate font-mono text-[0.65625rem] uppercase tracking-etiqueta ${pago.clase}`}
        >
          {carrera.dorsal !== null ? `Dorsal #${carrera.dorsal}` : "Dorsal pendiente"} ·{" "}
          {pago.texto}
        </p>
      </div>

      <span aria-hidden className="shrink-0 text-lg font-bold text-texto/30">
        ›
      </span>
    </Link>
  );
}

/* ------------------------------------------------------------------------ */
/* Barra de percentil                                                        */
/* ------------------------------------------------------------------------ */

/**
 * Sitúa al corredor dentro de la carrera, no su tiempo absoluto: comparar un
 * 10K con un maratón por tiempo no dice nada, «mejor que el 82 %» sí.
 *
 * Solo se pinta con puesto y total publicados. El mínimo visible del 6 % evita
 * que al último clasificado le quede una barra invisible.
 */
export function percentilDe(puesto: number | null, total: number | null): number | null {
  if (puesto === null || !total || total <= 0) return null;
  return Math.max(6, Math.round((1 - puesto / total) * 100));
}

export function BarraPercentil({ puesto, total }: { puesto: number | null; total: number | null }) {
  const p = percentilDe(puesto, total);
  if (p === null) return null;
  return (
    <div
      className="h-[0.3125rem] w-full overflow-hidden rounded-full bg-texto/7"
      role="meter"
      aria-valuenow={p}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Percentil en la carrera"
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${p}%`,
          background: "linear-gradient(90deg, var(--color-azul), var(--color-cian))",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Tarjeta de resultado                                                      */
/* ------------------------------------------------------------------------ */

export function TarjetaResultado({ carrera }: { carrera: CarreraDelCorredor }) {
  const segundos = segundosDeIntervalo(carrera.tiempo);
  const ritmo =
    segundos !== null && carrera.distanciaKm ? formatRitmo(segundos, carrera.distanciaKm) : null;
  const sinPublicar = segundos === null;

  return (
    <Link
      href={`/portal/inscripciones/${carrera.inscripcionId}/resultado`}
      className="flex flex-col gap-1.5 rounded-xl border border-linea bg-superficie p-3.5 transition-colors hover:border-linea-fuerte"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-bold text-texto">
          {carrera.evento}
          {distanciaSiAporta(carrera.categoria, carrera.distanciaKm) &&
            ` ${distanciaSiAporta(carrera.categoria, carrera.distanciaKm)}`}
        </span>
        <span
          className={`tabular shrink-0 font-mono text-sm font-bold ${
            sinPublicar ? "text-texto/35" : carrera.esRecord ? "text-cian" : "text-texto/75"
          }`}
        >
          {sinPublicar ? "—:—:—" : formatTiempo(carrera.tiempo)}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[0.65625rem] uppercase tracking-etiqueta text-texto/45">
        <span className="tabular">
          {sinPublicar
            ? "Resultados en revisión"
            : [
                formatMesMono(carrera.fecha, carrera.zonaHoraria),
                carrera.puesto !== null &&
                  `Puesto ${carrera.puesto}${carrera.participantes ? `/${carrera.participantes}` : ""}`,
              ]
                .filter(Boolean)
                .join(" · ")}
        </span>
        {!sinPublicar &&
          (carrera.esRecord ? (
            <span className="text-naranja-suave">▲ Récord personal</span>
          ) : (
            ritmo && <span className="tabular">{ritmo}</span>
          ))}
      </div>

      {/* Sin resultados publicados no hay percentil que pintar. */}
      {!sinPublicar && (
        <div className="mt-1.5">
          <BarraPercentil puesto={carrera.puesto} total={carrera.participantes} />
        </div>
      )}
    </Link>
  );
}

/* ------------------------------------------------------------------------ */
/* Fila de la lista de inscripciones (1f-D)                                  */
/* ------------------------------------------------------------------------ */

export function FilaInscripcion({ carrera }: { carrera: CarreraDelCorredor }) {
  const [dia, mes] = formatFechaMono(carrera.fecha, carrera.zonaHoraria).split(" ");
  const anulada = carrera.estado === "anulada" || carrera.estado === "transferida";
  const debe =
    !anulada && carrera.clase === "proxima" && carrera.estadoPago !== "pagado";

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border border-linea bg-superficie p-3.5 ${
        anulada ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-3.5">
        <div className="flex w-10 shrink-0 flex-col items-center">
          <span
            className={`tabular text-lg font-extrabold leading-none tracking-display ${
              anulada
                ? "text-texto/35"
                : carrera.estado === "lista_espera"
                  ? "text-cian"
                  : "text-naranja-suave"
            }`}
          >
            {dia}
          </span>
          <span className="font-mono text-[0.5625rem] uppercase tracking-etiqueta text-texto/45">
            {mes}
          </span>
        </div>

        <Link
          href={`/portal/inscripciones/${carrera.inscripcionId}`}
          className="min-w-0 flex-1"
        >
          <p className={`truncate text-sm font-bold ${anulada ? "text-texto/50" : "text-texto"}`}>
            {carrera.evento}
            {carrera.categoria && ` ${carrera.categoria}`}
          </p>
          <p className="tabular truncate font-mono text-[0.65625rem] uppercase tracking-etiqueta text-texto/45">
            {carrera.categoria}
            {carrera.dorsal !== null && ` · Dorsal #${carrera.dorsal}`}
            {` · ${formatPrecio(carrera.precio, carrera.moneda)}`}
          </p>
        </Link>

        <BadgeEstadoPago carrera={carrera} />
      </div>

      {debe && (
        <div className="flex items-center justify-between gap-3 border-t border-linea pt-3">
          <span className="font-mono text-[0.65625rem] uppercase tracking-etiqueta text-naranja-suave">
            Falta coordinar el pago
          </span>
          <BotonEnlace
            href={`/portal/inscripciones/${carrera.inscripcionId}`}
            variante="primaria"
            tamano="sm"
          >
            Completar {formatPrecio(carrera.precio, carrera.moneda)}
          </BotonEnlace>
        </div>
      )}
    </div>
  );
}
