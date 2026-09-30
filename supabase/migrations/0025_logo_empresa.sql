-- 0025_logo_empresa.sql
-- Logo de la empresa en el encabezado, editable sin tocar código (igual que el
-- nombre en tienda_config). Bucket público: un logo no es información sensible
-- y así se muestra directo con su URL, sin firmar enlaces.
-- Idempotente.

alter table public.tienda_config
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public)
values ('logos-empresa', 'logos-empresa', true)
on conflict (id) do nothing;

drop policy if exists "logos_empresa_lectura_publica" on storage.objects;
create policy "logos_empresa_lectura_publica"
  on storage.objects for select
  using (bucket_id = 'logos-empresa');

drop policy if exists "logos_empresa_escritura_jefatura" on storage.objects;
create policy "logos_empresa_escritura_jefatura"
  on storage.objects for all to authenticated
  using      (bucket_id = 'logos-empresa' and public.current_persona_rol() = 'jefatura')
  with check (bucket_id = 'logos-empresa' and public.current_persona_rol() = 'jefatura');
