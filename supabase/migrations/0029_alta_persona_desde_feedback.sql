-- 0029_alta_persona_desde_feedback.sql
-- En este módulo no hay una pantalla de Personal aparte: la única forma de
-- que alguien exista en el sistema es siendo el sujeto de una falta o un
-- reconocimiento. Registrar a alguien por primera vez (CM + nombre, cédula
-- opcional) debe poder CREAR su fila en personal ahí mismo, no bloquear.
--
-- 1) La cédula deja de ser obligatoria (puede no tenerse a la mano al
--    registrar sobre la marcha). El índice único sigue siendo válido: en
--    Postgres varios NULL no chocan entre sí en un índice único.
-- 2) El CM sí debe ser único cuando existe — es la clave con la que se liga
--    todo el historial; evita que un typo cree sin querer una persona
--    duplicada con el mismo código.
-- Idempotente.

alter table public.personal alter column cedula drop not null;

create unique index if not exists personal_codigo_uniq
  on public.personal (codigo)
  where codigo is not null;
