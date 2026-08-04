import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * Limpia el HTML que escriben los organizadores en la descripción del evento.
 *
 * Ese texto se pinta con `dangerouslySetInnerHTML` en la ficha pública, así que
 * sin esto un `<img src=x onerror=...>` guardado por cualquier organizador se
 * ejecutaría en el navegador de todos los corredores que abran la carrera.
 *
 * Lista blanca, no lista negra: se permite exactamente lo que el editor puede
 * producir y nada más. Todo atributo `on*`, `style`, `class` e `id` cae solo por
 * no estar permitido.
 *
 * Vive aparte del esquema Zod a propósito: `validacion/eventos.ts` lo importa el
 * cliente, y meter la librería ahí la arrastraría al bundle del navegador.
 */
const OPCIONES: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "u", "s",
    "h2", "h3",
    "ul", "ol", "li",
    "blockquote", "a", "hr",
  ],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  // Un enlace del organizador apunta fuera del sitio: sin `noopener` la página
  // destino puede manipular la pestaña de origen.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      rel: "noopener noreferrer nofollow",
    }),
  },
  // Sin esto, `<p></p>` vacíos del editor se acumulan en la base de datos.
  exclusiveFilter: (marco) =>
    marco.tag === "p" && !marco.text.trim() && !marco.mediaChildren.length,
};

export function sanearHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPCIONES).trim();
}

/** Texto plano a partir del HTML, para resúmenes y metadatos de compartición. */
export function textoPlano(html: string | null | undefined, limite?: number): string {
  if (!html) return "";
  const texto = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
  return limite ? texto.slice(0, limite) : texto;
}
