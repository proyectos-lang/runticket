/*
 * Service worker de RunTicket HN.
 *
 * Hace una sola cosa: si el usuario abre la app sin conexión, en vez del
 * error del navegador ve /offline.html. No guarda en caché ninguna página de
 * la aplicación a propósito: inscripciones, pagos y dorsales cambian, y servir
 * una copia vieja sería peor que no servir nada.
 *
 * Se registra desde src/components/pwa/RegistroSW.tsx.
 */
const CACHE = "runticket-offline-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([OFFLINE, "/icons/icon-192.png"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  // Limpia cachés de versiones anteriores de este archivo.
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  // Solo navegaciones (abrir una página); el resto de peticiones no se tocan.
  if (evento.request.mode !== "navigate") return;
  evento.respondWith(
    fetch(evento.request).catch(() => caches.match(OFFLINE).then((r) => r ?? Response.error()))
  );
});
