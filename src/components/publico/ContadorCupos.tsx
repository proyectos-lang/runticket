import { categoriasConCupo } from "@/lib/eventos/consultas";

/**
 * «795 de 800 cupos disponibles» del héroe de la portada.
 *
 * Vive aparte porque es **el único dato de la portada que no se cachea**. Los
 * cupos tienen que ser reales (requisito 3.4): anunciar plazas que ya no existen
 * manda al corredor a llenar un formulario que va a fallar.
 *
 * Y por eso mismo tiene que ir dentro de su propio `<Suspense>`. Cuando esta
 * consulta se hacía en el cuerpo de la página, impedía prerenderizar la portada
 * entera —la página más importante para SEO— por una línea de escasez. Ahora la
 * portada se sirve al instante y esta cifra llega un momento después.
 *
 * Solo cuentan las categorías con tope: si ninguna lo tiene no hay escasez que
 * contar, y «0 de 0 cupos» sería peor que no decir nada.
 */
export async function ContadorCupos({ eventoId }: { eventoId: string }) {
  const categorias = await categoriasConCupo(eventoId);
  const conTope = categorias.filter((c) => c.cupo_maximo !== null);
  if (!conTope.length) return null;

  const disponibles = conTope.reduce((a, c) => a + (c.cupos_disponibles ?? 0), 0);
  const totales = conTope.reduce((a, c) => a + (c.cupo_maximo ?? 0), 0);

  return (
    <p className="tabular font-mono text-xs text-texto/45">
      <span className="text-naranja-suave">{disponibles}</span> de {totales} cupos disponibles
    </p>
  );
}
