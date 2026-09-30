// scripts/set-email.mjs
// Cambia el correo de acceso (auth.users.email) de una persona ya creada, y lo
// confirma de una vez (acción administrativa, no autoregistro: no hace falta
// que la persona haga clic en un correo de verificación para poder usarlo).
// Uso:
//   node --env-file=.env.local scripts/set-email.mjs --cedula 1234567890 --email correo@real.com

import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    cedula: { type: "string" },
    email: { type: "string" },
  },
});

if (!values.cedula || !values.email) {
  console.error("Uso: node --env-file=.env.local scripts/set-email.mjs --cedula <cedula> --email <correo>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: persona, error: pErr } = await admin
  .from("personal")
  .select("id, nombre, auth_user_id")
  .eq("cedula", values.cedula)
  .maybeSingle();

if (pErr) {
  console.error("Error buscando la persona:", pErr.message);
  process.exit(1);
}
if (!persona) {
  console.error(`No encontré a nadie con cédula ${values.cedula}.`);
  process.exit(1);
}
if (!persona.auth_user_id) {
  console.error(`${persona.nombre} no tiene usuario de acceso enlazado todavía.`);
  process.exit(1);
}

const { error: updErr } = await admin.auth.admin.updateUserById(persona.auth_user_id, {
  email: values.email,
  email_confirm: true,
});
if (updErr) {
  console.error("Error actualizando el correo:", updErr.message);
  process.exit(1);
}

console.log(`\n✓ Correo de ${persona.nombre} actualizado a ${values.email}.`);
console.log("  Ya puede entrar y recuperar su clave con ese correo.\n");
