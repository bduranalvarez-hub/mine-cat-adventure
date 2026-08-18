-- ============================================================
-- Otorgar una skin a una cuenta (herramienta de administración)
-- Pega esto en Supabase → SQL Editor → New query → Run
--
-- Para qué sirve: dar una skin sin pasar por su forma normal de
-- obtenerla. Casos: probar una skin recién agregada, compensar a un
-- jugador, o premiar a alguien de la comunidad.
--
-- NO confundir con los códigos de regalo (supabase-redeem-codes.sql):
-- aquellos entregan MONEDAS y los canjea el propio jugador. Esto es
-- una concesión directa que solo se puede hacer desde el panel.
--
-- IDs de skin válidos (deben existir en el LIST de js/skins.js, o el
-- cliente los ignora en silencio):
--   sphynx (inicial), pirata, doctor, bebe, siames, naranja  [común]
--   esqueleto, robot                                          [rara]
--   ads_epica  = Dragón                                       [épica]
--   gatoreal                                                  [legendaria]
-- ============================================================

-- ── 1) AJUSTA ESTAS DOS LÍNEAS ──────────────────────────────
--    El nombre NO distingue mayúsculas.
\set cuenta 'BDuran'
\set skin 'ads_epica'

-- Si tu cliente SQL no soporta \set (el editor web de Supabase NO lo
-- soporta), ignora las dos líneas de arriba y reemplaza a mano
-- 'BDuran' y 'ads_epica' en las consultas de abajo.

-- ── 2) Ver el estado ANTES ──────────────────────────────────
select name, skins_owned, active_skin
from public.accounts
where name_lower = lower('BDuran');

-- ── 3) Otorgar la skin (idempotente: si ya la tiene, no duplica) ──
update public.accounts
set skins_owned = case
      when skins_owned ? 'ads_epica' then skins_owned
      else skins_owned || '["ads_epica"]'::jsonb
    end,
    updated_at = now()
where name_lower = lower('BDuran');

-- ── 4) Verificar: skins_owned debe incluir la skin ──────────
select name, skins_owned, active_skin
from public.accounts
where name_lower = lower('BDuran');

-- ============================================================
-- IMPORTANTE — cómo la ve el juego:
-- El cliente NO sincroniza al arrancar. La skin baja del servidor solo
-- al INICIAR SESIÓN o al sincronizar progreso. Así que después de
-- correr esto, en el juego:
--   a) toca "cambiar" junto a tu nombre y vuelve a entrar con tu
--      nombre y clave  (camino seguro), o
--   b) juega una partida de 100 m o más: al ganar monedas se
--      sincroniza y la skin aparece.
-- Luego entra a la TIENDA: el Dragón mostrará EQUIPAR en vez del
-- contador de anuncios.
--
-- Para QUITAR una skin otorgada por error:
--   update public.accounts
--   set skins_owned = skins_owned - 'ads_epica', updated_at = now()
--   where name_lower = lower('BDuran');
-- (si era la activa, el cliente vuelve a sphynx al entrar)
-- ============================================================
