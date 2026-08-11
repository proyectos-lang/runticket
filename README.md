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

## Caché y renderizado

El proyecto usa **Cache Components** (`cacheComponents: true` en
`next.config.ts`), así que aquí no hay `revalidate` ni `dynamic = "force-dynamic"`
por ruta. Las reglas son tres:

1. **Lo público se cachea por datos, no por página.** Las consultas del catálogo
   viven en `src/lib/eventos/consultas.ts` con `"use cache"`, y usan
   `src/lib/supabase/publico.ts` — un cliente que **no lee cookies**, porque
   dentro de un ámbito cacheado no se puede.
2. **Lo privado va bajo `<Suspense>`.** Los layouts de `/panel`, `/admin`,
   `/portal` y `(auth)` envuelven todo su contenido, lo que cubre también a sus
   páginas. Por eso ninguna necesita marcarse una a una.
3. **Las mutaciones invalidan etiquetas, no rutas.** `revalidatePath("/eventos")`
   ya no basta: hay que invalidar la etiqueta que alimenta la consulta. Los
   nombres están en `src/lib/supabase/publico.ts` (`TAG_EVENTOS`, `tagEvento`,
   `tagOrganizador`) para que quien cachea y quien invalida no se separen.

Excepción deliberada: **los cupos disponibles no se cachean**. Servir una plaza
que ya no existe manda al corredor a llenar un formulario que va a fallar.

## Coste de los despliegues

Vercel factura los minutos de build **multiplicados por el tamaño de la máquina**,
así que lo que encarece un proyecto pequeño no es que su build sea lento, sino
cuántas veces se construye y en qué máquina. Un build completo de este repo son
unos 20 segundos, repartidos así:

| Fase | Tiempo |
|---|---|
| Compilación (Turbopack) | ~6 s |
| Comprobación de TypeScript | ~7,5 s |
| Generación estática (68 páginas) | ~2 s |
| Resto | ~4 s |

Tres reglas para que eso no se dispare:

1. **Máquina de build estándar**, no la «Enhanced». Este proyecto compila en seis
   segundos; con ocho núcleos cada build cuesta ocho veces más y apenas termina
   antes. Se elige en *Settings → Build & Development Settings*.

2. **No se construye por documentación.** El `ignoreCommand` de `vercel.json`
   salta el build cuando un commit solo tocó `*.md` o `docs/`. Si `HEAD^` no
   existe —un clon superficial, el primer commit— construye igualmente: ante la
   duda, se construye.

3. **Agrupar los cambios antes de empujar.** Cada `git push` es un despliegue, y
   los que fallan también se cobran. Conviene empujar por bloques de trabajo
   terminados, no por arreglo suelto.

> La comprobación de TypeScript es el 40 % del build y se puede desactivar con
> `typescript.ignoreBuildErrors`. **No está desactivada a propósito**: es la
> última puerta antes de producción, y «ya lo comprobamos en local» es la
> suposición que falla el día que alguien empuja con prisa. Si algún día pesa,
> primero hay que montar esa comprobación en CI y después quitarla de aquí.

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
