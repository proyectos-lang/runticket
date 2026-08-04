/** Marcas diacríticas combinantes: lo que `normalize("NFD")` separa de su letra. */
const TILDES = /[̀-ͯ]/g;

/**
 * Convierte un texto libre en un identificador apto para una URL.
 *
 *   "20 MIllas de Easy Count"  →  "20-millas-de-easy-count"
 *   "Maratón de Tegucigalpa"   →  "maraton-de-tegucigalpa"
 *   "Trail Ñeque 2027"         →  "trail-neque-2027"
 *
 * **Va en minúsculas a propósito.** Las rutas distinguen mayúsculas: si el slug
 * fuera `20MILLAS`, la dirección `/eventos/20millas` daría 404 y los buscadores
 * tratarían ambas como páginas distintas. Es la convención de la web.
 *
 * Los espacios y los signos no se borran, se convierten en guiones: pegar las
 * palabras («20millasdeeasycount») hace el enlace ilegible justo donde más se
 * lee, que es cuando alguien lo comparte por WhatsApp.
 *
 * No garantiza unicidad: de eso se encarga el índice de la base de datos, y
 * quien crea la carrera ve el resultado en un campo editable antes de guardar.
 */
export function generarSlug(texto: string): string {
  return (
    texto
      // Separa la tilde de su letra (á → a + ´) para poder descartarla y que
      // "Maratón" no acabe en "marat-n". La eñe se descompone igual.
      .normalize("NFD")
      .replace(TILDES, "")
      .toLowerCase()
      // Todo lo que no sea letra sin acento o cifra pasa a ser separador.
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 160)
      // El recorte anterior puede dejar un guion colgando al final.
      .replace(/-+$/, "")
  );
}
