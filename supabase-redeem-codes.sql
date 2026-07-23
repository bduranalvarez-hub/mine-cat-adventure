-- ============================================================
-- Mine Cat Adventure — Códigos de regalo (canje de monedas)
-- Pega TODO este script en Supabase: proyecto → SQL Editor → New query → Run
-- Es idempotente: seguro de volver a ejecutar.
--
-- Repartes un código a la comunidad y cada CUENTA puede canjearlo UNA
-- sola vez para recibir monedas de regalo. RLS bloquea todo acceso
-- directo del cliente a las tablas: solo la función redeem_code
-- (SECURITY DEFINER) las toca, así nadie puede leer los códigos ni
-- darse monedas saltándose la validación.
-- ============================================================

-- Catálogo de códigos. Insertas filas aquí para crear códigos nuevos
-- (ver el ejemplo al final). El código se compara SIN distinguir
-- mayúsculas ("VERANO2026" = "verano2026"). Usa códigos largos y
-- aleatorios (8+ caracteres) para que nadie los adivine al azar.
create table if not exists public.redeem_codes (
  code       text        primary key check (char_length(code) between 3 and 40),
  coins      int         not null check (coins > 0 and coins <= 100000),
  active     boolean     not null default true,
  -- Tope de canjes TOTALES (entre todas las cuentas). null = ilimitado.
  max_total  int         check (max_total is null or max_total > 0),
  used_total int         not null default 0,
  -- Fecha de vencimiento. null = no vence nunca.
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Un canje por cuenta y código: el índice único rechaza el segundo
-- intento de la misma cuenta con el mismo código.
create table if not exists public.redeem_redemptions (
  id                 bigint      generated always as identity primary key,
  code               text        not null,
  account_name_lower text        not null,
  coins              int         not null,
  created_at         timestamptz not null default now()
);
create unique index if not exists redeem_once_per_account
  on public.redeem_redemptions (code, account_name_lower);

alter table public.redeem_codes enable row level security;
alter table public.redeem_redemptions enable row level security;
-- Sin policies para anon: lectura/escritura directas quedan cerradas.
-- Todo pasa por redeem_code().

-- Canjea un código por monedas y las suma a la cuenta. Requiere el
-- token de sesión de la cuenta (igual que sync_account), así solo el
-- dueño autenticado puede canjear. Devuelve {"ok":true,"coins":N,
-- "balance":M} o {"error":"..."} (codigo_invalido, codigo_vencido,
-- codigo_agotado, ya_canjeado, no_autorizado).
create or replace function public.redeem_code(p_name text, p_token text, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acc public.accounts;
  v_code public.redeem_codes;
  v_norm text := upper(trim(coalesce(p_code, '')));
  v_new_coins int;
begin
  if v_norm = '' then
    return jsonb_build_object('error', 'codigo_invalido');
  end if;

  -- Autentica la cuenta con su token de sesión.
  select * into v_acc from public.accounts
    where name_lower = lower(trim(p_name)) and session_token = p_token;
  if not found then
    return jsonb_build_object('error', 'no_autorizado');
  end if;

  -- Busca el código (sin distinguir mayúsculas) y lo bloquea para el
  -- resto de la transacción: dos canjes simultáneos no rebasan el tope.
  select * into v_code from public.redeem_codes
    where upper(code) = v_norm for update;
  if not found or not v_code.active then
    return jsonb_build_object('error', 'codigo_invalido');
  end if;
  if v_code.expires_at is not null and v_code.expires_at <= now() then
    return jsonb_build_object('error', 'codigo_vencido');
  end if;
  if v_code.max_total is not null and v_code.used_total >= v_code.max_total then
    return jsonb_build_object('error', 'codigo_agotado');
  end if;

  -- Registra el canje: el índice único (code, account_name_lower)
  -- rechaza el segundo intento de la misma cuenta.
  begin
    insert into public.redeem_redemptions (code, account_name_lower, coins)
    values (v_code.code, v_acc.name_lower, v_code.coins);
  exception when unique_violation then
    return jsonb_build_object('error', 'ya_canjeado');
  end;

  update public.redeem_codes
    set used_total = used_total + 1
    where code = v_code.code;

  v_new_coins := v_acc.coins + v_code.coins;
  update public.accounts
    set coins = v_new_coins, updated_at = now()
    where id = v_acc.id;

  return jsonb_build_object('ok', true, 'coins', v_code.coins, 'balance', v_new_coins);
end;
$$;

grant execute on function public.redeem_code(text, text, text) to anon;

-- ============================================================
-- Cómo CREAR códigos para repartir a la comunidad
-- ============================================================
-- Código simple de 500 monedas, sin tope ni vencimiento:
--   insert into public.redeem_codes (code, coins) values ('BIENVENIDA', 500);
--
-- Código de 1000 monedas, máximo 100 canjes, vence el 31/12/2026:
--   insert into public.redeem_codes (code, coins, max_total, expires_at)
--   values ('VERANO2026', 1000, 100, '2026-12-31 23:59:59+00');
--
-- Desactivar un código sin borrarlo (deja de funcionar):
--   update public.redeem_codes set active = false where code = 'VERANO2026';
--
-- Ver cuántas veces se canjeó cada código:
--   select code, coins, used_total, max_total, active, expires_at
--   from public.redeem_codes order by created_at desc;
