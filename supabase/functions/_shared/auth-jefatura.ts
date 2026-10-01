// Boilerplate repetido en las 4 Edge Functions de este módulo: validar el
// header Authorization, resolver el usuario de Supabase Auth, y confirmar
// que su fila en `personal` tiene rol "jefatura" (es quien puede generar
// feedbacks/planes/reconocimientos o leer imágenes — este módulo no tiene
// ninguna acción de IA disponible para el rol "asesor"). Centralizado acá
// para no repetir el mismo bloque idéntico en cada función.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { json } from "./cors.ts";

type Resultado =
  | { ok: true; supabaseAsUser: SupabaseClient }
  | { ok: false; response: Response };

/**
 * @param mensajeNoAutorizado Mensaje a devolver (403) si la sesión es válida
 *   pero el rol no es jefatura — cada función lo redacta a su manera
 *   ("Solo jefatura puede generar feedback.", etc.) para no cambiar el texto
 *   que ya ve jefatura si algo falla.
 */
export async function requireJefatura(
  req: Request,
  mensajeNoAutorizado: string,
): Promise<Resultado> {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    return { ok: false, response: json({ error: "Faltan variables de entorno (SUPABASE_URL, SUPABASE_ANON_KEY)." }, 500) };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { ok: false, response: json({ error: "Falta encabezado Authorization." }, 401) };
  }

  const supabaseAsUser = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabaseAsUser.auth.getUser();
  if (userErr || !user) {
    return { ok: false, response: json({ error: "Sesión inválida o expirada." }, 401) };
  }

  const { data: caller } = await supabaseAsUser
    .from("personal")
    .select("rol")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!caller || caller.rol !== "jefatura") {
    return { ok: false, response: json({ error: mensajeNoAutorizado }, 403) };
  }

  return { ok: true, supabaseAsUser };
}
