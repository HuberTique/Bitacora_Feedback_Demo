-- 0027_cm_vigencia_otro.sql
-- 1) roster_publico() ahora incluye el CM (código de empleado) — la
--    identificación de personas en Feedbacks debe validar igual que en
--    Ventas consolidadas: por CM, nunca solo por nombre escrito a mano.
-- 2) La vigencia de la escalera pasa de 4 a 3 meses (compute_ocurrencia).
-- 3) Tipo de falta "Otro", para casos que no encajan en la matriz — pide
--    descripción obligatoria (columna requiere_descripcion).
-- Idempotente.

drop function if exists public.roster_publico();

create or replace function public.roster_publico()
returns table (
  id uuid,
  nombre text,
  cargo text,
  rol text,
  rol_jerarquico text,
  foto_path text,
  codigo text
)
language sql
stable
security definer
set search_path = public
as $$
  select id, nombre, cargo, rol, rol_jerarquico::text, foto_path, codigo
  from public.personal
  where activo = true
  order by nombre;
$$;

grant execute on function public.roster_publico() to anon, authenticated;

-- Vigencia de 3 meses.
create or replace function public.compute_ocurrencia(
  p_persona_id uuid,
  p_tipo_id    text,
  p_fecha      date
) returns table (ocurrencia integer, accion text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_vigencia_meses int := 3;
  v_ladder text[];
  v_count  int;
  v_n      int;
  v_accion text;
begin
  select ladder into v_ladder from public.faltas_config where tipo_id = p_tipo_id;
  if v_ladder is null then
    raise exception 'Tipo de falta no existe: %', p_tipo_id;
  end if;

  select count(*) into v_count
  from public.retardos r
  where r.persona_id = p_persona_id
    and r.tipo_id    = p_tipo_id
    and r.fecha     <= p_fecha
    and r.fecha     >= (p_fecha - make_interval(months => v_vigencia_meses))
    and r.excusa_suficiente is not true;

  v_n      := v_count + 1;
  v_accion := v_ladder[least(v_n, array_length(v_ladder, 1))];

  return query select v_n, v_accion;
end
$$;

-- Tipo de falta "Otro" — la descripción obligatoria se guarda en
-- retardos.observacion (ya existente); esta columna solo marca que ese
-- tipo la exige.
alter table public.faltas_config
  add column if not exists requiere_descripcion boolean not null default false;

insert into public.faltas_config (tipo_id, nombre, requiere_minutos, ladder, posicion, requiere_descripcion, articulos_relacionados)
values ('otro', 'Otro', false, array['Feedback Verbal', 'Feedback Escrito', 'Descargos por escrito'], 99, true,
  (select array_agg(id) from public.reglamento_articulos where numero = '62'))
on conflict (tipo_id) do update set requiere_descripcion = true;
