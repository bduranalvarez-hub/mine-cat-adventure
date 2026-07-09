-- ============================================================
-- Limpieza de datos de PRUEBA del ranking mundial
-- Pega esto en Supabase → SQL Editor → New query → Run
--
-- Borra únicamente las filas de prueba generadas durante el
-- desarrollo. NO toca a los jugadores reales.
-- ============================================================

-- 1) Ver qué se va a borrar ANTES de borrar (opcional, para revisar):
-- select name, meters, mode from public.scores
-- where name ~ '^(HC|EZ)[0-9]+$'
--    or name in ('__zz_test', 'Tester', 'Miner', 'Minero', 'PruebaClaude')
-- order by mode, meters desc;

-- 2) Borrar las filas de prueba.
delete from public.scores
where name ~ '^(HC|EZ)[0-9]+$'
   or name in ('__zz_test', 'Tester', 'Miner', 'Minero', 'PruebaClaude');

-- 3) Verificar el resultado: deberían quedar solo jugadores reales.
select mode, name, meters
from public.scores
order by mode, meters desc;
