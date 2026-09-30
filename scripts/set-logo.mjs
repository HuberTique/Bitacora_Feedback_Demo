// scripts/set-logo.mjs
// Sube el logo de la empresa al bucket público "logos-empresa" y lo deja
// apuntado en tienda_config.logo_url. Reemplaza el logo anterior si ya había
// uno (siempre se sube con el mismo nombre de archivo).
// Uso:
//   node --env-file=.env.local scripts/set-logo.mjs --archivo ./logo.png

import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const { values } = parseArgs({ options: { archivo: { type: "string" } } });
if (!values.archivo) {
  console.error("Uso: node --env-file=.env.local scripts/set-logo.mjs --archivo <ruta-del-logo>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  process.exit(1);
}

const ext = extname(values.archivo).toLowerCase().replace(".", "") || "png";
const tipo = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", webp: "image/webp" }[ext] ?? "image/png";
const bytes = readFileSync(values.archivo);

const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const ruta = `empresa.${ext}`;
const { error: upErr } = await admin.storage
  .from("logos-empresa")
  .upload(ruta, bytes, { contentType: tipo, upsert: true });
if (upErr) {
  console.error("Error subiendo el logo:", upErr.message);
  process.exit(1);
}

const { data: pub } = admin.storage.from("logos-empresa").getPublicUrl(ruta);
// Cache-busting: si se reemplaza el logo con el mismo nombre, el navegador
// no debe seguir mostrando el viejo desde caché.
const logoUrl = `${pub.publicUrl}?v=${Date.now()}`;

const { error: updErr } = await admin.from("tienda_config").update({ logo_url: logoUrl }).eq("id", true);
if (updErr) {
  console.error("Error guardando logo_url:", updErr.message);
  process.exit(1);
}

console.log(`\n✓ Logo actualizado: ${logoUrl}\n`);
