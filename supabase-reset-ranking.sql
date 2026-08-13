-- ============================================================
-- Reinicio COMPLETO del ranking mundial
-- Pega esto en Supabase → SQL Editor → New query → Run
--
-- Por qué se borra TODO y no solo las filas de prueba (para eso está
-- supabase-cleanup-test-data.sql): hasta el parche del 2026-08-13, la
-- tabla scores tenía una política de INSERT abierta y submit_score no
-- pedía autenticación. La clave anon es pública -viaja en el bundle-,
-- así que cualquiera pudo escribir el nombre y la distancia que
-- quisiera, y no hay forma de distinguir una marca legítima de una
-- inventada. Ninguna fila anterior a ese parche es confiable.
--
-- A partir de ahora toda marca llega autenticada con el token de la
-- cuenta y se guarda con el nombre canónico de esa cuenta, así que el
-- ranking vuelve a significar algo desde cero.
--
-- NO toca la tabla accounts: las cuentas, sus monedas y sus skins se
-- conservan intactas. Solo se pierde el ranking mundial. Los récords
-- personales de cada jugador viven en su dispositivo (localStorage) y
-- tampoco se ven afectados.
-- ============================================================

-- 1) RESPALDO. Copia las filas actuales a una tabla aparte antes de
--    borrar nada, por si hubiera que consultarlas después. Si la tabla
--    de respaldo ya existe (de una ejecución previa), esto no hace
--    nada y conserva el respaldo original.
create table if not exists public.scores_backup_pre_auth as
  select *, now() as backed_up_at from public.scores;

-- El respaldo no debe ser legible desde el cliente: contiene los
-- mismos nombres públicos, pero no hay ninguna razón para exponerlo.
alter table public.scores_backup_pre_auth enable row level security;
-- Sin policies: solo el service_role y el editor SQL pueden leerlo.

-- 2) Revisar qué se va a borrar y cuánto se respaldó.
select
  (select count(*) from public.scores)                   as filas_a_borrar,
  (select count(*) from public.scores_backup_pre_auth)   as filas_respaldadas;

-- 3) Vaciar el ranking. delete y no truncate: scores tiene RLS y
--    truncate necesita permisos mayores; delete deja además el
--    contador de filas afectadas a la vista.
delete from public.scores;

-- 4) Verificar. Debe devolver 0.
select count(*) as filas_restantes from public.scores;

-- ============================================================
-- Para recuperar el respaldo (SOLO si hiciera falta):
--   insert into public.scores (name, meters, mode, created_at)
--   select name, meters, mode, created_at
--   from public.scores_backup_pre_auth;
--
-- Para eliminar el respaldo cuando ya no se necesite:
--   drop table public.scores_backup_pre_auth;
-- ============================================================
