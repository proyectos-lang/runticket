import type { Disciplina } from "@/lib/supabase/database.types";

export const DISCIPLINA_LABEL: Record<Disciplina, string> = {
  ruta: "Ruta",
  trail: "Trail",
  montana: "Montaña",
  ciclismo: "Ciclismo",
  triatlon: "Triatlón",
  caminata: "Caminata",
  otro: "Otro",
};

/** Orden de aparición en el filtro del listado: de lo más común a lo más raro. */
export const DISCIPLINAS: Disciplina[] = [
  "ruta",
  "trail",
  "montana",
  "ciclismo",
  "triatlon",
  "caminata",
  "otro",
];
