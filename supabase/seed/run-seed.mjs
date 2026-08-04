/**
 * Ejecuta supabase/seed/0001_catalogo_honduras.sql sin necesidad de conexión
 * directa a Postgres: extrae los datos del propio .sql (fuente única de verdad)
 * y los inserta con la service role key vía PostgREST.
 *
 * Uso:  node --env-file=.env.local supabase/seed/run-seed.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const aquí = path.dirname(fileURLToPath(import.meta.url));
const sql = fs.readFileSync(path.join(aquí, "0001_catalogo_honduras.sql"), "utf8");

/**
 * Extrae solo tuplas de literales entrecomillados: ('X') o ('X','Y').
 * Ignora a propósito paréntesis que no son datos —(departamento_id, nombre),
 * (values, (select id from ...)— porque no empiezan con una comilla.
 */
const TUPLA = /\(\s*'((?:[^']|'')*)'\s*(?:,\s*'((?:[^']|'')*)'\s*)?\)/g;

function tuplas(fragmento) {
  return [...fragmento.matchAll(TUPLA)].map((m) =>
    [m[1], m[2]].filter((v) => v !== undefined).map((v) => v.replace(/''/g, "'"))
  );
}

/** La sentencia completa que inserta en `tabla`. */
function sentencia(tabla) {
  const inicio = sql.indexOf(`insert into public.${tabla}`);
  if (inicio === -1) throw new Error(`No se encontró el insert de ${tabla}`);
  const fin = sql.indexOf(";", inicio);
  return sql.slice(inicio, fin);
}

const paises = tuplas(sentencia("paises")).filter((t) => t.length === 2);
const departamentos = tuplas(sentencia("departamentos")).filter((t) => t.length === 1);
const ciudades = tuplas(sentencia("ciudades")).filter((t) => t.length === 2);

console.log(
  `Leídos del .sql: ${paises.length} países, ${departamentos.length} departamentos, ${ciudades.length} municipios.`
);

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { error: ePaises } = await db
  .from("paises")
  .upsert(
    paises.map(([nombre, codigo_iso]) => ({ nombre, codigo_iso })),
    { onConflict: "codigo_iso" }
  );
if (ePaises) throw new Error("paises: " + ePaises.message);

const { data: hn, error: eHn } = await db.from("paises").select("id").eq("codigo_iso", "HN").single();
if (eHn) throw new Error("no se encontró Honduras: " + eHn.message);

const { error: eDeps } = await db
  .from("departamentos")
  .upsert(
    departamentos.map(([nombre]) => ({ pais_id: hn.id, nombre })),
    { onConflict: "pais_id,nombre" }
  );
if (eDeps) throw new Error("departamentos: " + eDeps.message);

const { data: deps } = await db.from("departamentos").select("id, nombre").eq("pais_id", hn.id);
const idDe = new Map(deps.map((d) => [d.nombre, d.id]));

const huérfanos = ciudades.filter(([dep]) => !idDe.has(dep));
if (huérfanos.length) {
  throw new Error(
    `Municipios con departamento desconocido: ${[...new Set(huérfanos.map((h) => h[0]))].join(", ")}`
  );
}

const filas = ciudades.map(([dep, municipio]) => ({ departamento_id: idDe.get(dep), nombre: municipio }));
for (let i = 0; i < filas.length; i += 200) {
  const { error } = await db
    .from("ciudades")
    .upsert(filas.slice(i, i + 200), { onConflict: "departamento_id,nombre" });
  if (error) throw new Error("ciudades: " + error.message);
}

const [{ count: nPaises }, { count: nDeps }, { count: nCiudades }] = await Promise.all([
  db.from("paises").select("*", { count: "exact", head: true }),
  db.from("departamentos").select("*", { count: "exact", head: true }),
  db.from("ciudades").select("*", { count: "exact", head: true }),
]);

console.log(`Sembrado: ${nPaises} países, ${nDeps} departamentos, ${nCiudades} municipios.`);
