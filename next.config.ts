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
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
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
