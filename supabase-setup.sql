-- ============================================================
-- Mine Cat Adventure — configuración del ranking mundial
-- Pega TODO este script en Supabase: proyecto → SQL Editor → New query → Run
-- Es idempotente: seguro de volver a ejecutar sobre una base existente.
-- ============================================================

-- Tabla de puntuaciones. Los CHECK validan los datos EN EL SERVIDOR:
-- nadie puede insertar un modo inválido, un nombre larguísimo ni una
-- distancia absurda, aunque manipule el cliente.
create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  name       text        not null check (char_length(name) between 1 and 14),
  meters     int         not null check (meters >= 0 and meters <= 100000),
  mode       text        not null check (mode in ('normal','hard','hardcore')),
  created_at timestamptz not null default now()
);

-- Una sola fila por jugador y modo (la tabla no crece sin control).
-- 1) Elimina duplicados existentes, conservando la mejor marca.
delete from public.scores a
using public.scores b
where a.name = b.name
  and a.mode = b.mode
  and (a.meters < b.meters or (a.meters = b.meters and a.id > b.id));

-- 2) Restricción única (name, mode). Guardada para poder re-ejecutar.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'scores_name_mode_key'
  ) then
    alter table public.scores
      add constraint scores_name_mode_key unique (name, mode);
  end if;
end $$;

-- Índice para ordenar rápido por modo y distancia.
create index if not exists scores_mode_meters_idx
  on public.scores (mode, meters desc);

-- Seguridad a nivel de fila.
alter table public.scores enable row level security;

-- Cualquiera puede LEER el ranking (es público).
drop policy if exists "lectura publica" on public.scores;
create policy "lectura publica" on public.scores
  for select using (true);

-- Inserción directa permitida (respaldo del cliente). Con la
-- restricción única, un intento de duplicar (name, mode) falla, así
-- que nadie puede sobrescribir la marca de otro por esta vía. NO hay
-- políticas de UPDATE ni DELETE: quedan prohibidas para el cliente.
drop policy if exists "insertar puntuacion" on public.scores;
create policy "insertar puntuacion" on public.scores
  for insert with check (true);

-- Enviar puntuación: inserta o ACTUALIZA solo si supera la marca
-- previa del jugador en ese modo. SECURITY DEFINER para poder hacer
-- el upsert sin abrir una política de UPDATE al cliente. Los CHECK de
-- la tabla siguen validando los datos.
create or replace function public.submit_score(p_name text, p_meters int, p_mode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.scores (name, meters, mode)
  values (p_name, p_meters, p_mode)
  on conflict (name, mode)
  do update set meters = excluded.meters, created_at = now()
  where excluded.meters > public.scores.meters;
end;
$$;

-- Función del ranking: top N por modo (ya hay una fila por jugador).
create or replace function public.top_scores(mode_key text, max_rows int default 10)
returns table(name text, meters int)
language sql
stable
as $$
  select s.name, s.meters
  from public.scores s
  where s.mode = mode_key
  order by s.meters desc
  limit max_rows
$$;

-- Permite llamar las funciones a usuarios anónimos (el juego).
grant execute on function public.submit_score(text, int, text) to anon;
grant execute on function public.top_scores(text, int) to anon;

-- ============================================================
-- Cuentas: vincula monedas y skins a un nombre + PIN, para que el
-- progreso sobreviva a un cambio de dispositivo o a borrar los datos
-- de la app. RLS bloquea TODO acceso directo del cliente a la tabla
-- (ni lectura ni escritura): solo las funciones SECURITY DEFINER de
-- abajo pueden tocarla, así el hash del PIN nunca sale del servidor.
-- ============================================================
-- Supabase suele instalar pgcrypto en el esquema "extensions" (no en
-- "public"). Si el proyecto no la tenía, esto la crea ahí; si ya
-- existía en otro esquema, "if not exists" no la mueve, pero
-- search_path = public, extensions (en auth_account) cubre ambos casos.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.accounts (
  id              bigint generated always as identity primary key,
  name            text        not null check (char_length(name) between 1 and 14),
  name_lower      text        not null generated always as (lower(name)) stored,
  pin_hash        text        not null,
  session_token   text        not null,
  coins           int         not null default 0 check (coins >= 0),
  skins_owned     jsonb       not null default '["sphynx"]'::jsonb,
  active_skin     text        not null default 'sphynx',
  -- Bloqueo por intentos fallidos: un PIN de 4 dígitos solo tiene
  -- 10.000 combinaciones, así que sin límite de intentos cualquiera
  -- podría adivinarlo probando todas. Ver auth_account más abajo.
  failed_attempts int         not null default 0,
  locked_until    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Por si la tabla ya existía de una versión anterior de este script.
alter table public.accounts add column if not exists failed_attempts int not null default 0;
alter table public.accounts add column if not exists locked_until timestamptz;

create unique index if not exists accounts_name_lower_key
  on public.accounts (name_lower);

alter table public.accounts enable row level security;
-- Sin policies para anon: select/insert/update quedan cerrados por
-- completo desde el cliente. Todo pasa por las funciones de abajo.

-- Inicia sesión o crea la cuenta si el nombre no existe todavía
-- (evita una pantalla de registro aparte). Si el nombre ya existe, el
-- PIN debe coincidir. Los nombres son únicos sin distinguir mayúsculas
-- (constraint sobre name_lower).
--
-- Rate limit: 5 PIN incorrectos seguidos bloquean la cuenta 5 minutos.
-- Los errores esperados (PIN incorrecto, cuenta bloqueada, etc.) se
-- devuelven como {"error": "..."} en vez de con raise exception: una
-- excepción deshace TODO el trabajo de la función, incluyendo el
-- contador de intentos fallidos que justo queremos conservar.
create or replace function public.auth_account(p_name text, p_pin text)
returns jsonb
language plpgsql
security definer
-- pgcrypto (crypt/gen_salt) vive en el esquema "extensions" en
-- Supabase, no en "public": sin agregarlo aquí, la función no
-- encuentra esas funciones y falla con "gen_salt(unknown) does not
-- exist" aunque la extensión esté instalada.
set search_path = public, extensions
as $$
declare
  v_name text := trim(p_name);
  v_row public.accounts;
  v_max_attempts constant int := 5;
  v_lockout_seconds constant int := 300;
  v_base_attempts int;
  v_new_attempts int;
  v_remaining int;
begin
  if v_name = '' or char_length(v_name) > 14 then
    return jsonb_build_object('error', 'nombre_invalido');
  end if;
  if p_pin !~ '^[0-9]{4,8}$' then
    return jsonb_build_object('error', 'pin_invalido');
  end if;

  select * into v_row from public.accounts where name_lower = lower(v_name) for update;

  if found then
    if v_row.locked_until is not null and v_row.locked_until > now() then
      v_remaining := ceil(extract(epoch from (v_row.locked_until - now())));
      return jsonb_build_object('error', 'cuenta_bloqueada', 'retryAfter', v_remaining);
    end if;

    if v_row.pin_hash <> crypt(p_pin, v_row.pin_hash) then
      -- Si el bloqueo anterior ya venció, el contador arranca de
      -- nuevo: el jugador recupera intentos frescos tras esperar.
      v_base_attempts := case
        when v_row.locked_until is not null and v_row.locked_until <= now() then 0
        else v_row.failed_attempts
      end;
      v_new_attempts := v_base_attempts + 1;

      if v_new_attempts >= v_max_attempts then
        update public.accounts
          set failed_attempts = v_new_attempts,
              locked_until = now() + make_interval(secs => v_lockout_seconds),
              updated_at = now()
          where id = v_row.id;
        return jsonb_build_object(
          'error', 'cuenta_bloqueada', 'retryAfter', v_lockout_seconds
        );
      end if;

      update public.accounts
        set failed_attempts = v_new_attempts, locked_until = null, updated_at = now()
        where id = v_row.id;
      return jsonb_build_object('error', 'pin_incorrecto');
    end if;

    if v_row.failed_attempts > 0 or v_row.locked_until is not null
       or v_row.session_token is null or v_row.session_token = '' then
      update public.accounts
        set failed_attempts = 0,
            locked_until = null,
            session_token = coalesce(nullif(v_row.session_token, ''), gen_random_uuid()::text),
            updated_at = now()
        where id = v_row.id
        returning * into v_row;
    end if;
  else
    insert into public.accounts (name, pin_hash, session_token)
    values (v_name, crypt(p_pin, gen_salt('bf')), gen_random_uuid()::text)
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'name', v_row.name,
    'token', v_row.session_token,
    'coins', v_row.coins,
    'skinsOwned', v_row.skins_owned,
    'activeSkin', v_row.active_skin
  );
end;
$$;

-- Sincroniza el progreso local con el remoto: fusiona (no pisa) para
-- que jugar offline en dos dispositivos nunca haga perder monedas ni
-- skins ya compradas. p_token debe coincidir con el de auth_account.
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

  v_coins := greatest(v_row.coins, coalesce(p_coins, 0));
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

grant execute on function public.auth_account(text, text) to anon;
grant execute on function public.sync_account(text, text, int, jsonb, text) to anon;
