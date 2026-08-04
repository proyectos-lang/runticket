# RunTicket

Proyecto Next.js (App Router, TypeScript, Tailwind CSS) preparado para conectarse a [Supabase](https://supabase.com) y desplegarse en [Vercel](https://vercel.com).

## Stack

- [Next.js 16](https://nextjs.org) — App Router, Server Actions.
- [Tailwind CSS 4](https://tailwindcss.com)
- [Supabase](https://supabase.com) vía `@supabase/supabase-js` y `@supabase/ssr` (clientes de navegador, servidor y proxy ya configurados en `src/lib/supabase/`).

> Este repo usa una versión reciente de Next.js con cambios respecto a versiones anteriores (por ejemplo, `middleware.ts` ahora es `proxy.ts`). Antes de añadir código nuevo, conviene repasar `node_modules/next/dist/docs/`.

## Empezar

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Copia `.env.example` a `.env.local` y rellena las credenciales de tu proyecto de Supabase (Project Settings → API):

   ```bash
   cp .env.example .env.local
   ```

3. Arranca el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   Abre [http://localhost:3000](http://localhost:3000).

## Supabase

- `src/lib/supabase/client.ts` — cliente para Client Components.
- `src/lib/supabase/server.ts` — cliente para Server Components / Route Handlers / Server Actions (usa cookies).
- `src/lib/supabase/middleware.ts` + `src/proxy.ts` — refresco de sesión en cada petición.

El esquema de base de datos y la lógica de la aplicación todavía están por definir.

## Despliegue en Vercel

1. Sube el repositorio a GitHub/GitLab/Bitbucket.
2. Importa el proyecto en [vercel.com/new](https://vercel.com/new).
3. Configura las variables de entorno (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) en el proyecto de Vercel.
4. Despliega. Vercel detecta Next.js automáticamente.

## Scripts

- `npm run dev` — servidor de desarrollo.
- `npm run build` — build de producción.
- `npm run start` — sirve el build de producción.
- `npm run lint` — ESLint.
