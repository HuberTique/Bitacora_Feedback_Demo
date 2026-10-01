-- 0030_aislar_modulo_feedbacks.sql
--
-- Este proyecto Supabase ("bitacora-feedback-demo") es un módulo aislado y
-- vendible por separado (Feedbacks y planes de trabajo) — no es el mismo
-- proyecto que usa la tienda 690 (Skechers) en producción. Sin embargo, las
-- migraciones 0001-0024 se heredaron tal cual del proyecto completo, así
-- que este proyecto quedó con el esquema ENTERO de la app grande: Horarios,
-- Presupuestos/Ventas, Ranking/Podio, Maximizador, "Magia con una sonrisa",
-- Requerimientos, Pendientes — nada de eso tiene UI en este módulo, nunca
-- se usa, y solo agranda la superficie de RLS/seguridad sin aportar nada.
--
-- Esta migración limpia esa herencia: borra únicamente las tablas, funciones
-- y buckets de Storage que el código de ESTE módulo nunca referencia (se
-- verificó con grep en src/ y supabase/functions/ antes de escribir esto).
-- Se CONSERVAN intactos: personal, retardos, faltas_config, reconocimientos,
-- reglamento_articulos, tienda_config, notificaciones, el enum
-- rol_jerarquico_t, y las funciones compute_ocurrencia/roster_publico/
-- current_persona_id/current_persona_rol/tg_set_updated_at.
--
-- Si en el futuro se necesita reconectar este módulo con el resto de la
-- app (ej. una empresa compra el paquete completo), el esquema de esos
-- otros módulos se reintroduce desde el repo principal (Bitacora_Tienda_Sk)
-- en vez de mantenerlo dormido aquí — así el CM/`personal` ya es compatible
-- (mismo modelo de identidad) y la reconexión es solo volver a aplicar esas
-- migraciones, no rediseñar nada.
--
-- No idempotente a propósito (es una limpieza puntual de una vez), pero usa
-- "if exists" en todo para poder reintentarse sin error si algo ya se borró.

-- ================================================================
-- 1) Funciones RPC de Ranking/Gamificación — se buscan dinámicamente en el
--    catálogo (varias tienen más de una sobrecarga, ej. ranking_faltas(int,
--    int) y ranking_faltas(date,date) coexistieron entre migraciones) para
--    no depender de adivinar la firma exacta.
-- ================================================================
do $$
declare
  r record;
begin
  for r in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(array[
        'ranking_ventas', 'ranking_semanal', 'ranking_avance',
        'ranking_faltas', 'ranking_magia', 'ranking_maximizador',
        'confirmar_magia', 'check_distribucion_pct'
      ])
  loop
    execute format('drop function if exists public.%I(%s) cascade', r.proname, r.args);
  end loop;
end $$;

-- ================================================================
-- 2) Storage: policies de buckets de otros módulos (fotos para el podio,
--    evidencias de requerimientos), por nombre exacto tal como se crearon
--    en 0012 y 0018. Los buckets y sus objetos NO se borran aquí: Supabase
--    bloquea el DELETE directo sobre storage.objects/buckets desde SQL
--    ("Direct deletion from storage tables is not allowed. Use the Storage
--    API instead.") — se eliminan aparte con scripts/borrar-buckets.mjs
--    (Storage API, con la service role key).
-- ================================================================
drop policy if exists "leer fotos personal"       on storage.objects;
drop policy if exists "subir fotos personal"      on storage.objects;
drop policy if exists "actualizar fotos personal" on storage.objects;
drop policy if exists "borrar fotos personal"     on storage.objects;

drop policy if exists "leer evidencias propias o jefatura" on storage.objects;
drop policy if exists "subir evidencia propia"             on storage.objects;
drop policy if exists "borrar evidencia propia o jefatura" on storage.objects;

-- ================================================================
-- 3) Tablas de otros módulos. CASCADE se encarga de policies, triggers,
--    índices y FKs propios de cada tabla (ninguna tabla que SÍ se conserva
--    depende de estas — se verificó antes de escribir esta migración).
--    Dropear una tabla también la saca sola de la publicación Realtime, así
--    que "pendientes" y "requerimientos" no necesitan un paso aparte ahí.
-- ================================================================
drop table if exists public.presupuestos_semanales   cascade;
drop table if exists public.presupuestos_diarios      cascade;
drop table if exists public.presupuestos_uploads      cascade;
drop table if exists public.ventas_asesor_dia         cascade;
drop table if exists public.personal_codigos_alternos cascade;
drop table if exists public.horarios                  cascade;
drop table if exists public.horarios_config           cascade;
drop table if exists public.disponibilidad_pt         cascade;
drop table if exists public.dias_bloqueados           cascade;
drop table if exists public.meses_retail              cascade;
drop table if exists public.pendientes                cascade;
drop table if exists public.requerimientos            cascade;
drop table if exists public.kpis_mensuales            cascade;
drop table if exists public.magia_evaluaciones        cascade;
drop table if exists public.maximizador_registros     cascade;
drop table if exists public.maximizador_items         cascade;
drop table if exists public.puntos_extra              cascade;
drop table if exists public.ranking_historial         cascade;
drop table if exists public.ranking_config            cascade;

-- ================================================================
-- 4) Tipo enum que solo usaba ventas_asesor_dia (ya borrada arriba).
--    rol_jerarquico_t NO se toca: lo sigue usando personal.rol_jerarquico.
-- ================================================================
drop type if exists public.motivo_no_venta_t;
