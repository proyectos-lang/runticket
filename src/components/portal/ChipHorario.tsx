/**
 * Chip de jornada de entrega.
 *
 * En cian por defecto porque es un dato. **Si la jornada es hoy pasa a naranja**
 * y se antepone `HOY`: el día previo a la carrera, saber cuál de los tres
 * horarios está abierto ahora mismo es lo único que el corredor necesita, y
 * buscarlo entre chips idénticos es exactamente lo que falla con prisa.
 *
 * El horario es texto libre (`viernes 2–7 p. m. y sábado 9 a. m.–1 p. m.`),
 * así que «hoy» solo se detecta cuando el organizador declara una fecha; sin
 * ella el chip se queda en cian, que es la lectura conservadora.
 */
export function ChipHorario({ texto, esHoy = false }: { texto: string; esHoy?: boolean }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-[0.3125rem] px-2.75 py-1.5 font-mono text-[0.65625rem] font-semibold uppercase tracking-etiqueta ${
        esHoy ? "bg-naranja/14 text-naranja-suave" : "bg-cian/12 text-cian"
      }`}
    >
      {esHoy && <span className="font-bold">Hoy ·</span>}
      {texto}
    </span>
  );
}

/**
 * Heurística mínima para saber si un horario en texto libre cae hoy: se busca
 * el nombre del día de la semana actual dentro del texto. No es exacta —no
 * pretende serlo—, pero acierta en el formato que usan los organizadores
 * hondureños y nunca marca como «hoy» algo que no menciona el día.
 */
export function horarioEsHoy(texto: string | null): boolean {
  if (!texto) return false;
  const dia = new Intl.DateTimeFormat("es-HN", { weekday: "long" }).format(new Date());
  return texto.toLowerCase().includes(dia.toLowerCase());
}
