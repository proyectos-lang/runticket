import type { MetadataRoute } from "next";

/**
 * Manifiesto de la aplicación: lo que hace que RunTicket se pueda **instalar**
 * como app en Windows, macOS y Android (Chrome y Edge ofrecen «Instalar») y
 * que en iPhone, al añadirla a la pantalla de inicio, se abra a pantalla
 * completa, sin la barra de Safari.
 *
 * Next sirve esto en `/manifest.webmanifest` y lo enlaza solo desde el `<head>`.
 *
 * Dos juegos de iconos a propósito: los `any` llevan el isotipo recortado con
 * fondo transparente; los `maskable` llevan fondo oscuro de la marca y el
 * isotipo en el 60 % central, porque Android recorta el icono a círculo o a la
 * forma que elija el fabricante y sin ese margen cortaría al corredor.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "RunTicket HN",
    short_name: "RunTicket",
    description: "Inscripciones para carreras populares en Honduras.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#07080a",
    theme_color: "#07080a",
    lang: "es",
    dir: "ltr",
    categories: ["sports", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Accesos directos al mantener pulsado el icono (Android, Windows).
    shortcuts: [
      {
        name: "Mis inscripciones",
        short_name: "Inscripciones",
        url: "/portal/inscripciones",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Carreras",
        url: "/eventos",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
