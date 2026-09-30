-- 0028_articulos_editables.sql
-- reglamento_articulos solo tenía lectura para authenticated (0026). Ahora
-- que hay un editor en Feedbacks (pestaña "Reglamento y matriz") para que
-- Recursos Humanos actualice los artículos, jefatura necesita poder
-- insertar/editar/borrar — mismo patrón que faltas_config.
-- Idempotente.

grant insert, update, delete on public.reglamento_articulos to authenticated;

drop policy if exists "jefatura_write_articulos" on public.reglamento_articulos;
create policy "jefatura_write_articulos"
  on public.reglamento_articulos for all to authenticated
  using      (public.current_persona_rol() = 'jefatura')
  with check (public.current_persona_rol() = 'jefatura');
