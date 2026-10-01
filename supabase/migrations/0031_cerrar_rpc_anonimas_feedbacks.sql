-- 0031_cerrar_rpc_anonimas_feedbacks.sql
--
-- Campaña de pruebas de seguridad sobre este módulo aislado: se probó con la
-- llave pública (anon), SIN iniciar sesión, y DOS funciones SECURITY DEFINER
-- resultaron ejecutables de todas formas — el mismo bug ya documentado y
-- corregido para las RPC de ranking en el app completa (0024_cerrar_rpc_
-- anonimas.sql): Postgres deja las funciones ejecutables por PUBLIC (que
-- incluye "anon") por defecto, aunque el GRANT explícito solo sea a
-- "authenticated". Hay que REVOCAR el acceso de PUBLIC/anon a mano.
--
-- 1) compute_ocurrencia(uuid, text, date) — NUNCA tuvo grant a anon en
--    ninguna migración (0005/0027 solo otorgan a "authenticated"), pero
--    por el bug de arriba sí era ejecutable sin sesión. Devuelve cuántas
--    "ocurrencias" vigentes tiene una persona para un tipo de falta y qué
--    sanción aplica — antecedente disciplinario real. Con un persona_id
--    válido (ver punto 2), cualquiera sin cuenta podía consultarlo.
--
-- 2) roster_publico() — SÍ tenía grant explícito a anon desde el diseño
--    original (0001), pensado para el login viejo basado en elegir el
--    nombre de una lista antes de autenticarse. Este módulo ya NO tiene esa
--    pantalla (el login es por correo y clave — ver src/app/login/page.tsx);
--    el único lugar del código que llama a roster_publico() es
--    src/app/feedbacks/page.tsx, y solo después de confirmar sesión y rol
--    jefatura. Además, el comentario original en 0001 decía explícitamente
--    "Solo columnas seguras (id, nombre, cargo, rol) — sin cédula ni
--    código", pero 0027 le agregó la columna `codigo` (el CM) sin revisar
--    ese acceso anónimo — quedó exponiendo nombre + CM + persona_id de
--    TODO el roster activo (incluye personas reales) sin ninguna
--    autenticación, y encadenado con el punto 1, permitía enumerar el
--    historial disciplinario de cualquier persona sin cuenta.
--
-- Ambas quedan solo para "authenticated". Idempotente.

revoke execute on function public.compute_ocurrencia(uuid, text, date) from public, anon;
grant  execute on function public.compute_ocurrencia(uuid, text, date) to authenticated;

revoke execute on function public.roster_publico() from public, anon;
grant  execute on function public.roster_publico() to authenticated;
