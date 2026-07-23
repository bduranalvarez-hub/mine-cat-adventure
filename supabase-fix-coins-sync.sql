-- ============================================================
-- Mine Cat Adventure — FIX: monedas se "reembolsaban" al gastar
-- Pega TODO este script en Supabase: SQL Editor → New query → Run
-- Es idempotente (create or replace). Arregla web Y app nativa de una
-- vez, porque la logica vive en el servidor (esta funcion RPC).
--
-- BUG: sync_account fusionaba las monedas con greatest(server, cliente).
-- Al comprar una skin, el cliente subia un saldo MENOR, greatest
-- conservaba el viejo y el cliente lo readoptaba -> la compra se
-- "reembolsaba" y las skins salian gratis.
-- FIX: las monedas pasan a ser autoritativas del cliente (se guarda
-- p_coins tal cual). Las skins siguen en union (nunca se pierden).
-- ============================================================

create or replace function public.sync_account(
  p_name text, p_token text, p_coins int,
  p_skins_owned jsonb, p_active_skin text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.accounts;
  v_coins int;
  v_skins jsonb;
  v_active text;
begin
  select * into v_row from public.accounts
    where name_lower = lower(trim(p_name)) and session_token = p_token;
  if not found then
    raise exception 'no_autorizado';
  end if;

  -- Monedas autoritativas del cliente (ver comentario del bug arriba).
  v_coins := coalesce(p_coins, v_row.coins);
  select coalesce(jsonb_agg(distinct v), '["sphynx"]'::jsonb)
    into v_skins
    from (
      select jsonb_array_elements_text(v_row.skins_owned) as v
      union
      select jsonb_array_elements_text(coalesce(p_skins_owned, '[]'::jsonb))
    ) u;
  v_active := case
    when p_active_skin is not null and v_skins @> to_jsonb(p_active_skin)
      then p_active_skin
    else v_row.active_skin
  end;

  update public.accounts
    set coins = v_coins, skins_owned = v_skins, active_skin = v_active, updated_at = now()
    where id = v_row.id;

  return jsonb_build_object(
    'name', v_row.name, 'coins', v_coins,
    'skinsOwned', v_skins, 'activeSkin', v_active
  );
end;
$$;

-- Opcional: corregir cuentas de tester que quedaron con monedas
-- infladas por el bug. Ajusta el nombre y el saldo que quieras dejar.
-- (name_lower compara sin distinguir mayusculas.)
--   update public.accounts set coins = 0 where name_lower = 'silvia';
--
-- Ver saldos actuales de todas las cuentas:
--   select name, coins, skins_owned from public.accounts order by coins desc;
