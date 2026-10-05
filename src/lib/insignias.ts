import type { TipoCriterioInsignia } from "@/lib/supabase/database.types";

/**
 * Los cuatro criterios con los que se gana una insignia, con el texto que ve
 * el organizador al crearla.
 *
 * Vive aquí y no en `actions.ts` a propósito: ese archivo es `"use server"`, y
 * todo lo que exporta llega al navegador convertido en una referencia a una
 * función de servidor. Importar este array desde ahí hacía que el formulario de
 * insignias se rompiera al abrirse («p.find is not a function»).
 */
export const TIPOS_CRITERIO: { valor: TipoCriterioInsignia; etiqueta: string; unidad: string; ayuda: string }[] = [
  {
    valor: "carreras_completadas",
    etiqueta: "Carreras completadas contigo",
    unidad: "carreras",
    ayuda: "Cuenta las carreras tuyas ya finalizadas en las que participó.",
  },
  {
    valor: "distancia_acumulada",
    etiqueta: "Kilómetros acumulados contigo",
    unidad: "km",
    ayuda: "Suma la distancia de las categorías que corrió en tus carreras.",
  },
  {
    valor: "distancia_en_una_carrera",
    etiqueta: "Distancia en una sola carrera",
    unidad: "km",
    ayuda: "Para premiar la hazaña: completar una 21K o una 42K tuya.",
  },
  {
    valor: "anos_distintos",
    etiqueta: "Años distintos corriendo contigo",
    unidad: "años",
    ayuda: "Fidelidad en el tiempo: tres ediciones seguidas, por ejemplo.",
  },
];
