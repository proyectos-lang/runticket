export const ZONA_POR_DEFECTO = "America/Tegucigalpa";

/**
 * Convierte el valor de un `<input type="datetime-local">` ("2026-11-15T06:30")
 * a un instante absoluto, interpretándolo **en la zona del evento**.
 *
 * `new Date("2026-11-15T06:30")` lo interpretaría en la zona del proceso de Node
 * —UTC en producción—, así que la hora que el organizador escribe se guardaría
 * desplazada, y cada guardado la movería otra vez.
 */
export function fechaLocalAIso(valor: string, zona = ZONA_POR_DEFECTO): string {
  // Se parte de la lectura en UTC y se corrige por la diferencia que esa misma
  // marca tiene en la zona destino (cubre horario de verano, porque el desfase
  // se mide sobre la fecha concreta, no sobre una constante).
  const comoUtc = new Date(`${valor}Z`);
  const desfase = comoUtc.getTime() - fechaEnZona(comoUtc, zona).getTime();
  return new Date(comoUtc.getTime() + desfase).toISOString();
}

/** Instante absoluto → "2026-11-15T06:30" tal como debe verse en la zona del evento. */
export function isoAFechaLocal(iso: string, zona = ZONA_POR_DEFECTO): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));

  const v = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  // `en-CA` da la hora 24 como "24" a medianoche; se normaliza a "00".
  const hora = v("hour") === "24" ? "00" : v("hour");
  return `${v("year")}-${v("month")}-${v("day")}T${hora}:${v("minute")}`;
}

/** La misma marca temporal leída como si el reloj de la zona fuera el del sistema. */
function fechaEnZona(fecha: Date, zona: string): Date {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(fecha);
  const v = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  return new Date(
    Date.UTC(v("year"), v("month") - 1, v("day"), v("hour") % 24, v("minute"), v("second"))
  );
}

export function formatFechaLarga(fecha: string | Date, zona = ZONA_POR_DEFECTO): string {
  return new Intl.DateTimeFormat("es-HN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: zona,
  }).format(new Date(fecha));
}

export function formatFechaHora(fecha: string | Date, zona = ZONA_POR_DEFECTO): string {
  return new Intl.DateTimeFormat("es-HN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: zona,
  }).format(new Date(fecha));
}

export function formatFechaCorta(fecha: string | Date, zona = ZONA_POR_DEFECTO): string {
  return new Intl.DateTimeFormat("es-HN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: zona,
  }).format(new Date(fecha));
}

/**
 * Fecha corta en versalitas para los bloques mono del diseño: «22 AGO 2026».
 *
 * Se compone por partes en vez de con `format()`: es-HN intercala conectores
 * («15 de nov de 2026») y el punto abreviativo, y ambos descuadran una columna
 * monoespaciada.
 */
export function formatFechaMono(fecha: string | Date, zona = ZONA_POR_DEFECTO): string {
  const partes = new Intl.DateTimeFormat("es-HN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: zona,
  }).formatToParts(new Date(fecha));
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value.replace(/\./g, "") ?? "";
  return `${parte("day")} ${parte("month")} ${parte("year")}`.toUpperCase();
}

/** Hora en 24h para las tiras de datos: «05:00». */
export function formatHoraMono(fecha: string | Date, zona = ZONA_POR_DEFECTO): string {
  return new Intl.DateTimeFormat("es-HN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: zona })
    .format(new Date(fecha));
}

export function formatPrecio(monto: number, moneda = "HNL"): string {
  return new Intl.NumberFormat("es-HN", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
  }).format(monto);
}

export function formatDistancia(km: number | null): string | null {
  if (km === null || km === undefined) return null;
  return Number.isInteger(km) ? `${km} K` : `${km} km`;
}

/**
 * La distancia formateada, o null si la categoría ya la dice.
 *
 * Casi todos los organizadores llaman «10K» a la categoría de 10 km, así que
 * ponerlas juntas sin más daba «10K · 10 K» en las fichas del corredor.
 */
export function distanciaSiAporta(categoria: string, km: number | null): string | null {
  const d = formatDistancia(km);
  if (d === null) return null;
  const normalizar = (s: string) => s.replace(/\s+/g, "").toUpperCase();
  return normalizar(categoria) === normalizar(d) ? null : d;
}

/**
 * Postgres devuelve `interval` como "01:23:45" o "1 day 01:23:45"; se muestra
 * en h:mm:ss quitando los ceros de horas innecesarios.
 */
export function formatTiempo(intervalo: string | null): string {
  if (!intervalo) return "—";
  const m = intervalo.match(/(\d+):(\d{2}):(\d{2})/);
  if (!m) return intervalo;
  const [, h, min, seg] = m;
  return Number(h) > 0 ? `${Number(h)}:${min}:${seg}` : `${min}:${seg}`;
}

/** Ritmo en m:ss por kilómetro, el formato que usa cualquier corredor. */
export function formatRitmo(segundos: number, km: number): string | null {
  if (!km || km <= 0 || segundos <= 0) return null;
  const porKm = Math.round(segundos / km);
  return `${Math.floor(porKm / 60)}:${String(porKm % 60).padStart(2, "0")} /km`;
}

/** Mes y año en versalitas para las fichas del historial: «NOV 2026». */
export function formatMesMono(fecha: string | Date, zona = ZONA_POR_DEFECTO): string {
  const partes = new Intl.DateTimeFormat("es-HN", {
    month: "short",
    year: "numeric",
    timeZone: zona,
  }).formatToParts(new Date(fecha));
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value.replace(/\./g, "") ?? "";
  return `${parte("month")} ${parte("year")}`.toUpperCase();
}

/** "Edad 18–40 años", "Desde 16 años", "Hasta 12 años" o null si no hay límites. */
export function formatRangoEdad(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) return `Edad ${min}–${max} años`;
  if (min !== null) return `Desde ${min} años`;
  if (max !== null) return `Hasta ${max} años`;
  return null;
}

/** Edad que tendrá la persona el día del evento (lo que valida la categoría). */
export function edadEnFecha(fechaNacimiento: string, fechaEvento: string | Date): number {
  const nac = new Date(fechaNacimiento);
  const ref = new Date(fechaEvento);
  let edad = ref.getFullYear() - nac.getFullYear();
  const mes = ref.getMonth() - nac.getMonth();
  if (mes < 0 || (mes === 0 && ref.getDate() < nac.getDate())) edad--;
  return edad;
}

export function diasHasta(fecha: string | Date): number {
  const ms = new Date(fecha).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
