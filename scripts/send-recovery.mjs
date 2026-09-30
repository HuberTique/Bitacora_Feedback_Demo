// scripts/send-recovery.mjs
// Dispara el correo de "definir tu clave" para una cuenta ya creada (con su
// correo real ya configurado vía set-email.mjs). Usa la llave pública, igual
// que lo hace el botón "¿Olvidaste tu clave?" del sitio — no requiere la
// llave de servicio.
// Uso: node --env-file=.env.local scripts/send-recovery.mjs --email correo@real.com

import { createClient } from "@supabase/supabase-js";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { email: { type: "string" } } });
if (!values.email) {
  console.error("Uso: node --env-file=.env.local scripts/send-recovery.mjs --email <correo>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local.");
  process.exit(1);
}

const client = createClient(url, key, { auth: { persistSession: false } });
const { error } = await client.auth.resetPasswordForEmail(values.email, {
  redirectTo: "https://hubertique.github.io/Bitacora_Feedback_Demo/restablecer-clave/",
});
if (error) {
  console.error("Error enviando el correo:", error.message);
  process.exit(1);
}
console.log(`\n✓ Correo de recuperación enviado a ${values.email}.\n`);
