// scripts/borrar-buckets.mjs
// Borra uno o más buckets de Storage completos (archivos + el bucket mismo)
// usando la Storage API con la service role key. Supabase bloquea el DELETE
// directo sobre storage.objects/storage.buckets desde SQL ("Use the Storage
// API instead"), así que esta es la única forma correcta de limpiarlos.
//
// Se usó una sola vez para quitar "fotos-personal" y "requerimientos-evidencias"
// (buckets de otros módulos heredados por error al copiar las migraciones del
// app completa — ver 0030_aislar_modulo_feedbacks.sql) de este proyecto
// aislado de Feedbacks, donde nunca tuvieron archivos.
//
// Uso:
//   node --env-file=.env.local scripts/borrar-buckets.mjs --bucket fotos-personal --bucket requerimientos-evidencias

import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { bucket: { type: "string", multiple: true } },
});
if (!values.bucket || values.bucket.length === 0) {
  console.error("Uso: node --env-file=.env.local scripts/borrar-buckets.mjs --bucket <id> [--bucket <id> ...]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

for (const bucketId of values.bucket) {
  console.log(`\n--- ${bucketId} ---`);

  // Vacía el bucket primero (recursivo: lista carpetas y archivos sueltos).
  async function listarTodo(prefix = "") {
    const { data, error } = await admin.storage.from(bucketId).list(prefix, { limit: 1000 });
    if (error) throw new Error(`listando "${prefix}": ${error.message}`);
    let rutas = [];
    for (const item of data ?? []) {
      const ruta = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        // Es una "carpeta" (sin id propio en el storage de Supabase) — recursa.
        rutas = rutas.concat(await listarTodo(ruta));
      } else {
        rutas.push(ruta);
      }
    }
    return rutas;
  }

  const rutas = await listarTodo();
  if (rutas.length > 0) {
    console.log(`Borrando ${rutas.length} archivo(s): ${rutas.join(", ")}`);
    const { error: rmErr } = await admin.storage.from(bucketId).remove(rutas);
    if (rmErr) {
      console.error(`Error borrando archivos de "${bucketId}":`, rmErr.message);
      process.exit(1);
    }
  } else {
    console.log("Bucket ya estaba vacío.");
  }

  const { error: delErr } = await admin.storage.deleteBucket(bucketId);
  if (delErr) {
    console.error(`Error borrando el bucket "${bucketId}":`, delErr.message);
    process.exit(1);
  }
  console.log(`✓ Bucket "${bucketId}" borrado.`);
}

console.log("\nListo.\n");
