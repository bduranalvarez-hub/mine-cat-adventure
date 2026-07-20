-- ============================================================
-- Limpieza de datos de PRUEBA del ranking mundial
-- Pega esto en Supabase → SQL Editor → New query → Run
--
-- Borra únicamente las filas de prueba generadas durante el
-- desarrollo. NO toca a los jugadores reales.
-- ============================================================

-- Prefijos de nombres usados SOLO en pruebas de desarrollo. Se
-- comparan sin distinguir mayúsculas y no coinciden con nombres de
-- jugadores reales.
--   ZzCaseRank / ZzDelTest / CaseT / RankCase / RLTest / RLOk /
--   DirectCallTest / DebugTest / UserA / UserB / UserC
-- 1) Ver qué se va a borrar ANTES de borrar (opcional, para revisar):
-- select name, meters, mode from public.scores
-- where name ~ '^(HC|EZ)[0-9]+$'
--    or name ~* '^(ZzCaseRank|ZzDelTest|CaseT|RankCase|RLTest|RLOk|DirectCallTest|DebugTest|UserA|UserB|UserC)'
--    or name in ('__zz_test', 'Tester', 'Miner', 'Minero', 'PruebaClaude')
-- order by mode, meters desc;

-- 2) Borrar las filas de prueba del ranking.
delete from public.scores
where name ~ '^(HC|EZ)[0-9]+$'
   or name ~* '^(ZzCaseRank|ZzDelTest|CaseT|RankCase|RLTest|RLOk|DirectCallTest|DebugTest|UserA|UserB|UserC)'
   or name in ('__zz_test', 'Tester', 'Miner', 'Minero', 'PruebaClaude');

-- 3) Borrar las cuentas de prueba (tabla accounts). NO toca a los
--    jugadores reales: solo esos prefijos de desarrollo.
delete from public.accounts
where name ~* '^(ZzCaseRank|ZzDelTest|CaseT|RankCase|RLTest|RLOk|DirectCallTest|DebugTest|UserA|UserB|UserC)';

-- 4) Verificar el resultado: deberían quedar solo jugadores reales.
select mode, name, meters
from public.scores
order by mode, meters desc;
