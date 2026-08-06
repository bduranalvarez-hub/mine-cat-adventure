-- ============================================================
-- Mine Cat Adventure — Anuncios recompensados (AdMob)
-- Pega TODO este script en Supabase: proyecto → SQL Editor → New query → Run
-- Es idempotente: seguro de volver a ejecutar.
--
-- Contador de vistas de anuncio POR CUENTA. Solo cuentan los anuncios
-- RECOMPENSADOS que el jugador eligió ver (revivir o monedas), nunca
-- el banner pasivo. El tope diario (10) y el desbloqueo de la skin
-- épica (100 vistas totales) se calculan y aplican en el SERVIDOR, no
-- en localStorage, para que no se puedan falsear desde el cliente.
-- ============================================================

alter table public.accounts add column if not exists ads_watched_total int not null default 0;
alter table public.accounts add column if not exists ads_watched_today int not null default 0;
-- Día (huso del servidor) del último anuncio contado; null = nunca.
alter table public.accounts add column if not exists ads_watched_date date;

-- Registra una vista de anuncio recompensado. Devuelve
-- {"ok":true,"today":N,"cap":10,"total":M,"unlockAt":100,
-- "epicUnlocked":bool} o {"error":"limite_diario","today":10,"cap":10}
-- / {"error":"no_autorizado"}. epicUnlocked es true SOLO en la
-- llamada donde el total cruza el umbral (para no repetir el aviso).
create or replace function public.record_ad_watch(p_name text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.accounts;
  v_today int;
  v_total int;
  v_unlocked boolean := false;
  v_skins jsonb;
  -- Placeholder: aún no existe el arte de la skin épica por anuncios.
  -- Se puede otorgar igual: el cliente ignora IDs que no reconoce en
  -- su catálogo (Skins.grant) hasta que se agregue esta skin al LIST,
  -- momento en el que el próximo login/sync la revela sin más cambios
  -- en el servidor.
  v_epic_id constant text := 'ads_epica';
  v_daily_cap constant int := 10;
  v_unlock_at constant int := 100;
begin
  select * into v_row from public.accounts
    where name_lower = lower(trim(p_name)) and session_token = p_token
    for update;
  if not found then
    return jsonb_build_object('error', 'no_autorizado');
  end if;

  -- Reinicia el contador diario si cambió el día (reloj del servidor,
  -- no el del dispositivo: evita que se salte el tope adelantando la
  -- hora del teléfono).
  if v_row.ads_watched_date is null or v_row.ads_watched_date <> current_date then
    v_today := 0;
  else
    v_today := v_row.ads_watched_today;
  end if;

  if v_today >= v_daily_cap then
    return jsonb_build_object('error', 'limite_diario', 'today', v_today, 'cap', v_daily_cap);
  end if;

  v_today := v_today + 1;
  v_total := v_row.ads_watched_total + 1;

  v_skins := v_row.skins_owned;
  if v_total >= v_unlock_at and not (v_skins ? v_epic_id) then
    v_skins := v_skins || to_jsonb(array[v_epic_id]);
    v_unlocked := true;
  end if;

  update public.accounts
    set ads_watched_today = v_today,
        ads_watched_total = v_total,
        ads_watched_date = current_date,
        skins_owned = v_skins,
        updated_at = now()
    where id = v_row.id;

  return jsonb_build_object(
    'ok', true, 'today', v_today, 'cap', v_daily_cap,
    'total', v_total, 'unlockAt', v_unlock_at, 'epicUnlocked', v_unlocked
  );
end;
$$;

-- Consulta el estado de anuncios SIN registrar una vista nueva (para
-- pintar el contador en la tienda al abrirla). "today" se calcula en
-- caliente igual que arriba, pero no escribe nada.
create or replace function public.get_ad_status(p_name text, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.accounts;
  v_today int;
begin
  select * into v_row from public.accounts
    where name_lower = lower(trim(p_name)) and session_token = p_token;
  if not found then
    return jsonb_build_object('error', 'no_autorizado');
  end if;
  v_today := case
    when v_row.ads_watched_date is null or v_row.ads_watched_date <> current_date then 0
    else v_row.ads_watched_today
  end;
  return jsonb_build_object(
    'today', v_today, 'cap', 10, 'total', v_row.ads_watched_total, 'unlockAt', 100
  );
end;
$$;

grant execute on function public.record_ad_watch(text, text) to anon;
grant execute on function public.get_ad_status(text, text) to anon;
