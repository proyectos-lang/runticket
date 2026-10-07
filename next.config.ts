import type { NextConfig } from "next";

// Las imágenes (banners, galería, logos) se sirven desde Supabase Storage, así que
// next/image necesita autorizar ese host explícitamente.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  /**
   * Requisito 8.7: renderizado estático/ISR para SEO y velocidad.
   *
   * Con esto, Next deja de renderizar cada página entera en cada petición y pasa
   * a servir un armazón estático al instante, rellenando por encima solo lo que
   * de verdad depende de quién mira (la sesión de la cabecera, los cupos
   * restantes). Es lo que en esta versión sustituye a `revalidate` y a
   * `dynamic = "force-dynamic"`, que ya no hacen falta y se han quitado.
   *
   * Las zonas privadas —panel, portal, consola y autenticación— siguen siendo
   * dinámicas de principio a fin: sus layouts envuelven todo su contenido en un
   * `<Suspense>`, que es la forma de decir «esto se calcula en cada petición».
   * Ahí no hay nada que cachear, porque no hay dos usuarios que vean lo mismo.
   */
  cacheComponents: true,
  async headers() {
    const desarrollo = process.env.NODE_ENV === "development";
    const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    // La página de cobro de PixelPay: a ella se envía al corredor al pagar.
    const pixelpay = [
      process.env.PIXELPAY_ENDPOINT,
      "https://pixelpay.app",
      "https://*.pixelpay.app",
      "https://pixelpay.dev",
      "https://*.pixelpay.dev",
    ]
      .filter((v): v is string => Boolean(v))
      .join(" ");
    /**
     * Política de contenido. Next inserta scripts y estilos en línea en cada
     * página, y un nonce exigiría renderizar dinámicamente hasta las páginas
     * públicas que hoy se sirven estáticas; por eso `'unsafe-inline'`. Lo que
     * sí cierra: ningún script, fuente ni conexión fuera de la aplicación y de
     * Supabase, ningún marco, ningún objeto, y ningún destino de formulario
     * que no sea la propia aplicación o PixelPay.
     */
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${desarrollo ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      // Portadas y avatares desde Supabase, mapas desde CARTO, iconos de
      // insignias desde donde los ponga cada organizador.
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co${desarrollo ? " ws: http://localhost:*" : ""}`,
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      `form-action 'self' ${pixelpay}`,
      "frame-ancestors 'none'",
      ...(desarrollo ? [] : ["upgrade-insecure-requests"]),
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Vercel ya manda HSTS, pero sin `includeSubDomains`; la auditoría lo pide.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: csp },
          // La cámara, solo para el escáner de check-in de esta misma aplicación.
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(), microphone=(), payment=(), usb=()" },
          // Vercel sirve las páginas prerenderizadas con `*`; nadie necesita
          // leer este sitio desde otro origen.
          { key: "Access-Control-Allow-Origin", value: sitio },
        ],
      },
      {
        // El service worker no se cachea nunca: una versión vieja atrapada en
        // el navegador sería imposible de actualizar.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
