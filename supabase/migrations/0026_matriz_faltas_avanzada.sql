-- 0026_matriz_faltas_avanzada.sql
-- Tres piezas, todas basadas en la lectura real del Reglamento Interno de
-- Trabajo (RIT) de Skechers Colombia S.A.S.:
--
--   1. reglamento_articulos: texto EXACTO (transcrito del documento, no
--      generado) de los artículos del RIT y las citas al Código Sustantivo
--      del Trabajo (CST) que el propio RIT ya hace — nunca se le pide a la
--      IA que recuerde un número de artículo de memoria.
--   2. excusa_suficiente / accion_aplicada / justificacion_ajuste en
--      retardos: el Art. 64 solo sanciona "sin excusa suficiente", y su
--      parágrafo dice que la sanción se aplica "teniendo en cuenta" los
--      antecedentes, las circunstancias, el cargo y los perjuicios — no es
--      un mandato mecánico. compute_ocurrencia deja de contar para la
--      escalera las faltas con excusa suficiente.
--   3. reconocimientos: feedback positivo, flujo propio y separado —sin
--      escalera, sin citas legales, sin relación con retardos.
--
-- Idempotente.

-- ================================================================
-- 1) Artículos verificados
-- ================================================================
create table if not exists public.reglamento_articulos (
  id         bigint generated always as identity primary key,
  fuente     text not null check (fuente in ('RIT', 'CST')),
  numero     text not null,                 -- "54", "64", "65.2"...
  titulo     text,
  texto      text not null,
  created_at timestamptz not null default now()
);
comment on table public.reglamento_articulos is
  'RIT = Reglamento Interno de Trabajo de la empresa (transcripción exacta). '
  'CST = Código Sustantivo del Trabajo, solo tal como el propio RIT lo cita.';

alter table public.reglamento_articulos enable row level security;
grant select on public.reglamento_articulos to authenticated;
grant all privileges on public.reglamento_articulos to service_role;

drop policy if exists "leer_articulos" on public.reglamento_articulos;
create policy "leer_articulos"
  on public.reglamento_articulos for select to authenticated using (true);

-- Semilla: artículos relevantes para los tipos de falta que ya existen.
insert into public.reglamento_articulos (fuente, numero, titulo, texto) values
('RIT', '54', 'Deberes de los trabajadores (literal j — puntualidad)',
 'j) Asistir puntualmente al sitio de trabajo, según el horario establecido, así como a las actividades laborales convocadas por la Empresa.'),

('RIT', '62', 'Falta disciplinaria — marco general',
 'Se considera falta disciplinaria por parte del trabajador y por lo tanto dará lugar a la imposición de la sanción correspondiente, el incumplimiento de las obligaciones y la incursión en las prohibiciones consignadas en la ley, la convención, el reglamento y las directivas, órdenes de modo particular y políticas internas de la Empresa. La empresa no puede imponer a sus trabajadores sanciones no previstas en este reglamento, en pactos, convenciones colectivas, fallos arbitrales o en contrato de trabajo (artículo 114, C.S.T). Parágrafo. La terminación del contrato con justa causa no es considerada como sanción disciplinaria.'),

('RIT', '64', 'Faltas leves y su sanción disciplinaria',
 'Se establecen las siguientes faltas leves y su sanción disciplinaria así: a. El retardo en la hora de entrada o el retiro prematuro en la hora de salida sin excusa suficiente implica por primera vez, seguimiento de desempeño por escrito y el respectivo descuento del día no laborado; por la segunda vez, suspensión en el trabajo en la mañana o en la tarde según el turno en que ocurra y por tercera vez suspensión en el trabajo hasta por tres días. b. La falta en el trabajo en la mañana, en la tarde o en el turno correspondiente, sin excusa suficiente cuando no cause perjuicio de consideración a la empresa, implica por primera vez suspensión en el trabajo hasta por tres días y por segunda vez suspensión en el trabajo hasta por ocho días. c. La falta total al trabajo durante el día sin excusa suficiente, cuando no cause perjuicio de consideración a la empresa, implica por primera vez, suspensión en el trabajo hasta por ocho días y por segunda vez, suspensión en el trabajo hasta por dos (2) meses. Otros incumplimientos. d) La violación leve por parte del trabajador de las obligaciones contractuales o reglamentarias implica por primera vez, suspensión en el trabajo hasta por ocho (8) días y por segunda vez suspensión en el trabajo hasta por dos (2) meses. Parágrafo. Las sanciones se aplicarán teniendo en cuenta los antecedentes o conducta anterior del trabajador, las circunstancias de la falta, el cargo del trabajador y los perjuicios sufridos por el empleador con motivo de la falta.'),

('RIT', '65.2', 'Faltas graves — numeral 2 (incumplimiento de procedimientos)',
 'El incumplimiento de las obligaciones laborales establecidas en los diferentes manuales de funciones, circulares, correos electrónicos y difusiones laborales. Parágrafo del Artículo 65: las faltas consideradas graves son justas causas para dar por terminado el contrato de trabajo en forma unilateral por parte de la empresa.'),

('RIT', '65.16', 'Faltas graves — numeral 16 (riñas y agresiones)',
 'Tomar parte en discusiones, riñas, peleas y agresiones en los lugares de trabajo de la empresa, o por fuera de estos, pero actuando en calidad de trabajador. Parágrafo del Artículo 65: las faltas consideradas graves son justas causas para dar por terminado el contrato de trabajo en forma unilateral por parte de la empresa.')
on conflict do nothing;

-- Vincula cada tipo de falta con sus artículos (el 62 siempre, como base legal general).
alter table public.faltas_config
  add column if not exists articulos_relacionados bigint[] not null default '{}';

update public.faltas_config set articulos_relacionados =
  (select array_agg(id) from public.reglamento_articulos where numero in ('62', '54', '64'))
  where tipo_id in ('llegada_menor10', 'llegada_10_45', 'llegada_mayor45', 'ausencia_parcial');

update public.faltas_config set articulos_relacionados =
  (select array_agg(id) from public.reglamento_articulos where numero in ('62', '64'))
  where tipo_id = 'ausencia_total';

update public.faltas_config set articulos_relacionados =
  (select array_agg(id) from public.reglamento_articulos where numero in ('62', '65.2'))
  where tipo_id = 'traspasos';

update public.faltas_config set articulos_relacionados =
  (select array_agg(id) from public.reglamento_articulos where numero in ('62', '65.16'))
  where tipo_id = 'irrespeto_violencia';

-- ================================================================
-- 2) Excusa suficiente y ajuste justificado (Art. 64 y su parágrafo)
-- ================================================================
alter table public.retardos
  add column if not exists excusa_suficiente    boolean not null default false,
  add column if not exists detalle_excusa       text,
  add column if not exists accion_aplicada      text,
  add column if not exists justificacion_ajuste text;
comment on column public.retardos.accion is
  'Acción sugerida por la escalera (compute_ocurrencia) — nunca se sobrescribe, queda como rastro.';
comment on column public.retardos.accion_aplicada is
  'Acción que realmente decide aplicar la DSM. NULL = igual a la sugerida (sin ajuste).';

-- Las faltas con excusa suficiente no cuentan para la escalera del tipo
-- (Art. 64: la sanción aplica "sin excusa suficiente").
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
  v_vigencia_meses int := 4;
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

-- ================================================================
-- 3) Reconocimientos (feedback positivo) — flujo aparte
-- ================================================================
create table if not exists public.reconocimientos (
  id             uuid primary key default gen_random_uuid(),
  persona_id     uuid not null references public.personal(id) on delete restrict,
  fecha          date not null,
  motivo         text not null,
  texto          text not null default '',
  estado         text not null default 'pendiente' check (estado in ('pendiente', 'realizada')),
  registrado_por uuid not null references public.personal(id) on delete restrict,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists reconocimientos_persona_idx on public.reconocimientos (persona_id);
create index if not exists reconocimientos_fecha_idx   on public.reconocimientos (fecha desc);

drop trigger if exists set_updated_at on public.reconocimientos;
create trigger set_updated_at
  before update on public.reconocimientos
  for each row execute function public.tg_set_updated_at();

alter table public.reconocimientos enable row level security;
grant all privileges on public.reconocimientos to service_role, authenticated;

drop policy if exists "jefatura_all_reconocimientos"   on public.reconocimientos;
drop policy if exists "asesor_read_own_reconocimientos" on public.reconocimientos;

create policy "jefatura_all_reconocimientos"
  on public.reconocimientos for all to authenticated
  using      (public.current_persona_rol() = 'jefatura')
  with check (public.current_persona_rol() = 'jefatura');

create policy "asesor_read_own_reconocimientos"
  on public.reconocimientos for select to authenticated
  using (persona_id = public.current_persona_id());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reconocimientos'
  ) then
    alter publication supabase_realtime add table public.reconocimientos;
  end if;
end $$;
