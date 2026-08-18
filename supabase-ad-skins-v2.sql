-- ============================================================
-- Skins épicas por anuncios: soporte para VARIAS, escalonadas
-- Pega esto en Supabase → SQL Editor → New query → Run
-- Es idempotente: seguro de volver a ejecutar.
--
-- Antes record_ad_watch otorgaba UNA sola skin ('ads_epica') al llegar
-- a 100 vistas. Ahora hay dos épicas con umbrales distintos, así que
-- la función recorre una lista:
--   ads_epica   (Dragón) → 100 vistas  (~10 días con el tope de 10/día)
--   ads_epica2  (Mago)   → 250 vistas  (~25 días)
--
-- Los umbrales DEBEN coincidir con unlockAt en js/skins.js. El servidor
-- es quien concede de verdad (escribe skins_owned); el cliente solo
-- pinta el avance.
--
-- Para agregar una épica nueva en el futuro: sumar un par
-- (id, umbral) al array v_skins de abajo y declararla en js/skins.js.
-- ============================================================

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
  v_skins jsonb;
  v_nuevas text[] := '{}';
  v_daily_cap constant int := 10;
  -- (id_de_skin, vistas_necesarias). Ordenadas por umbral.
  v_ids constant text[] := array['ads_epica', 'ads_epica2'];
  v_umbral constant int[] := array[100, 250];
  i int;
begin
  select * into v_row from public.accounts
    where name_lower = lower(trim(p_name)) and session_token = p_token
    for update;
  if not found then
    return jsonb_build_object('error', 'no_autorizado');
  end if;

  -- Reinicia el contador diario si cambió el día (reloj del SERVIDOR,
  -- no el del dispositivo: evita saltarse el tope adelantando la hora).
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

  -- Otorga TODAS las skins cuyo umbral ya se haya cruzado y que aún no
  -- tenga. El bucle (en vez de un if suelto) también repara el caso de
  -- una cuenta que cruzó un umbral cuando esa skin todavía no existía.
  v_skins := v_row.skins_owned;
  for i in 1 .. array_length(v_ids, 1) loop
    if v_total >= v_umbral[i] and not (v_skins ? v_ids[i]) then
      v_skins := v_skins || to_jsonb(array[v_ids[i]]);
      v_nuevas := array_append(v_nuevas, v_ids[i]);
    end if;
  end loop;

  update public.accounts
    set ads_watched_today = v_today,
        ads_watched_total = v_total,
        ads_watched_date = current_date,
        skins_owned = v_skins,
        updated_at = now()
    where id = v_row.id;

  return jsonb_build_object(
    'ok', true, 'today', v_today, 'cap', v_daily_cap, 'total', v_total,
    -- Se conserva unlockAt/epicUnlocked por compatibilidad con clientes
    -- viejos (apuntan a la PRIMERA skin); los nuevos usan 'unlocked'.
    'unlockAt', v_umbral[1],
    'epicUnlocked', ('ads_epica' = any(v_nuevas)),
    'unlocked', to_jsonb(v_nuevas)
  );
end;
$$;

grant execute on function public.record_ad_watch(text, text) to anon;

-- get_ad_status no cambia de firma, pero devuelve el primer umbral solo
-- como referencia: el cliente ya usa el unlockAt propio de cada skin.
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

grant execute on function public.get_ad_status(text, text) to anon;
