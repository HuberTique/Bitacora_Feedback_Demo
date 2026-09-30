// En GitHub Pages el sitio se sirve bajo un subpath (/Bitacora_Feedback_Demo) — ver next.config.ts.
// Next.js resuelve esto solo, salvo en rutas absolutas escritas a mano (enlaces de correo,
// redirectTo de Supabase Auth, fetch()), que hay que armar con este helper para que apunten al
// lugar correcto tanto en local (basePath vacío) como en Pages.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Antepone el basePath del sitio a una ruta absoluta (ej. "/restablecer-clave/"). */
export function assetPath(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

/** La misma ruta, como URL completa (origen + basePath + ruta) — para redirectTo de Supabase Auth. */
export function fullPath(path: string): string {
  if (typeof window === "undefined") return assetPath(path);
  return `${window.location.origin}${assetPath(path)}`;
}
