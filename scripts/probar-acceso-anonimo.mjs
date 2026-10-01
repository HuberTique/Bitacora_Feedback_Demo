// scripts/probar-acceso-anonimo.mjs
// Prueba de seguridad / regresión: ¿qué puede hacer alguien con la llave
// pública (anon), SIN iniciar sesión, contra este proyecto Supabase aislado?
// Para cada tabla usada por el módulo prueba SELECT e INSERT, para las RPCs
// (roster_publico, compute_ocurrencia) y las 4 Edge Functions prueba la
// llamada sin Authorization, y para el bucket público revisa que no admita
// subidas anónimas. Todo debe salir "BLOQUEADO" — cualquier "***...***" es
// un hallazgo de seguridad real (ver 0031_cerrar_rpc_anonimas_feedbacks.sql,
// que corrigió exactamente este tipo de hueco).
//
// Uso:
//   node --env-file=.env.local scripts/probar-acceso-anonimo.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const tablas = ["personal", "retardos", "faltas_config", "reconocimientos", "reglamento_articulos", "tienda_config", "notificaciones"];
// Nota: "tienda_config" SÍ debe salir expuesta con 1 fila — es a propósito
// (nombre/ciudad/logo de la tienda, para mostrarlos antes de iniciar sesión).
// Cualquier otra tabla de la lista con >0 filas sí sería un hallazgo real.

console.log("=== SELECT anónimo (sin login) por tabla ===");
console.log("(0 filas sin error es normal y seguro: RLS deja pasar la consulta pero no devuelve nada;");
console.log(" el hallazgo real sería >0 filas en una tabla que no deba ser pública.)");
for (const t of tablas) {
  const { data, error } = await anon.from(t).select("*").limit(3);
  if (error) console.log(`${t}: BLOQUEADO (${error.code} ${error.message})`);
  else if (data.length === 0) console.log(`${t}: OK (0 filas visibles sin sesión)`);
  else console.log(`${t}: *** EXPUESTO *** ${data.length} fila(s) visibles -> `, JSON.stringify(data).slice(0, 300));
}

console.log("\n=== INSERT anónimo (sin login) por tabla ===");
const payloads = {
  personal: { nombre: "ATAQUE ANON", codigo: "999999", cedula: null, cargo: "x", rol: "jefatura", rol_jerarquico: "jefe_tienda" },
  retardos: { persona_id: "00000000-0000-0000-0000-000000000000", tipo_id: "llegada_menor10", fecha: "2026-01-01", observacion: "x", accion: "x", registrado_por: "00000000-0000-0000-0000-000000000000" },
  faltas_config: { tipo_id: "hack", nombre: "hack", requiere_minutos: false, ladder: ["x"], posicion: 999 },
  reconocimientos: { persona_id: "00000000-0000-0000-0000-000000000000", fecha: "2026-01-01", motivo: "x", texto: "x", registrado_por: "00000000-0000-0000-0000-000000000000" },
  reglamento_articulos: { fuente: "RIT", numero: "999", texto: "inventado" },
  tienda_config: { id: true, nombre: "HACKEADO" },
  notificaciones: { tipo: "x", destinatario_jefatura: true, mensaje: "spam anonimo" },
};
for (const t of tablas) {
  const { data, error } = await anon.from(t).insert(payloads[t]).select();
  if (error) console.log(`${t}: BLOQUEADO (${error.code} ${error.message})`);
  else console.log(`${t}: *** INSERT ANONIMO LOGRADO *** `, JSON.stringify(data).slice(0, 300));
}

console.log("\n=== RPCs llamables sin login ===");
const rpcs = [
  ["roster_publico", {}],
  ["compute_ocurrencia", { p_persona_id: "00000000-0000-0000-0000-000000000000", p_tipo_id: "llegada_menor10", p_fecha: "2026-01-01" }],
];
for (const [fn, args] of rpcs) {
  const { data, error } = await anon.rpc(fn, args);
  if (error) console.log(`${fn}: BLOQUEADO (${error.code} ${error.message})`);
  else console.log(`${fn}: *** LLAMABLE SIN LOGIN *** `, JSON.stringify(data).slice(0, 300));
}

console.log("\n=== Edge Functions sin Authorization header ===");
for (const fn of ["generar-feedback-contenido", "generar-plan-trabajo", "generar-reconocimiento-contenido", "leer-retardos-imagen"]) {
  const res = await fetch(`${url}/functions/v1/${fn}`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: anonKey },
    body: JSON.stringify({}),
  });
  const text = await res.text();
  console.log(`${fn}: HTTP ${res.status} -> ${text.slice(0, 200)}`);
}

console.log("\n=== Storage: bucket logos-empresa (debe ser público solo lectura) ===");
const { data: pub, error: pubErr } = await anon.storage.from("logos-empresa").list();
console.log("list:", pubErr ? pubErr.message : JSON.stringify(pub));
const { data: up, error: upErr } = await anon.storage.from("logos-empresa").upload("ataque.png", new Blob(["x"]), { upsert: true });
console.log("upload anonimo:", upErr ? `BLOQUEADO (${upErr.message})` : "*** SUBIDA ANONIMA LOGRADA ***");
