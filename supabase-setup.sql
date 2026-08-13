-- ============================================================
-- Mine Cat Adventure — configuración del ranking mundial
-- Pega TODO este script en Supabase: proyecto → SQL Editor → New query → Run
-- Es idempotente: seguro de volver a ejecutar sobre una base existente.
-- ============================================================

-- ============================================================
-- Moderación de apodos EN EL SERVIDOR.
-- js/moderation.js hace el mismo filtro en el cliente, pero eso solo
-- sirve para dar un aviso amable al jugador: cualquiera puede llamar
-- la API directamente con la clave anon, que es pública. El ranking
-- mundial es contenido generado por el usuario y visible para todos,
-- así que el filtro que cuenta es este.
-- Mantener las dos listas en sintonía al editarlas.
-- ============================================================
create or replace function public.is_name_allowed(p_name text)
returns boolean
language plpgsql
immutable
as $$
declare
  -- Misma lista que BLOCKLIST en js/moderation.js.
  v_blocked text[] := array[
    'puta', 'puto', 'mierda', 'pendejo', 'gilipollas', 'cabron', 'zorra',
    'maricon', 'negrodemierda', 'violador', 'nazi', 'hitler',
    'fuck', 'shit', 'bitch', 'asshole', 'nigger', 'faggot', 'rape', 'cunt'
  ];
  v_norm text;
  v_word text;
begin
  -- Normaliza igual que el cliente: sin acentos, minúsculas y solo
  -- letras/números, para que no baste con "p.u.t.o" o "PÚTO".
  v_norm := regexp_replace(
    lower(translate(
      coalesce(p_name, ''),
      'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
      'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
    )),
    '[^a-z0-9]', '', 'g'
  );
  if v_norm = '' then
    return false;
  end if;
  foreach v_word in array v_blocked loop
    if position(v_word in v_norm) > 0 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

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

-- Una sola fila por jugador y modo, SIN distinguir mayúsculas
-- ("BDuran" y "bduran" son el mismo jugador; se conserva la grafía
-- de la primera fila registrada y la mejor marca).
-- 1) Elimina duplicados existentes, conservando la mejor marca.
delete from public.scores a
using public.scores b
where lower(a.name) = lower(b.name)
  and a.mode = b.mode
  and a.id <> b.id
  and (a.meters < b.meters or (a.meters = b.meters and a.id > b.id));

-- 2) La restricción vieja (sensible a mayúsculas) se reemplaza por un
--    índice único sobre lower(name). Idempotente.
alter table public.scores drop constraint if exists scores_name_mode_key;
create unique index if not exists scores_name_lower_mode_key
  on public.scores (lower(name), mode);

-- Índice para ordenar rápido por modo y distancia.
create index if not exists scores_mode_meters_idx
  on public.scores (mode, meters desc);

-- Seguridad a nivel de fila.
alter table public.scores enable row level security;

-- Cualquiera puede LEER el ranking (es público).
drop policy if exists "lectura publica" on public.scores;
create policy "lectura publica" on public.scores
  for select using (true);

-- NO hay política de INSERT, UPDATE ni DELETE: el cliente no escribe
-- en esta tabla por ninguna vía directa. La inserción libre que había
-- antes permitía a cualquiera con la clave anon (que es pública, va en
-- el bundle) publicar el nombre y la distancia que quisiera. Todo pasa
-- ahora por submit_score, que exige el token de la cuenta.
drop policy if exists "insertar puntuacion" on public.scores;

-- Enviar puntuación: inserta o ACTUALIZA solo si supera la marca
-- previa del jugador en ese modo. SECURITY DEFINER para poder hacer
-- el upsert sin abrir una política de UPDATE al cliente. Los CHECK de
-- la tabla siguen validando los datos.
--
-- Exige el token de sesión de la cuenta (el mismo de sync_account).
-- La marca se guarda SIEMPRE con el nombre canónico de la cuenta que
-- autentica, nunca con el que llega en p_name: así un jugador con
-- sesión válida tampoco puede escribir en la fila de otro.
--
-- Los invitados no tienen cuenta y por lo tanto no entran al ranking
-- mundial; conservan su ranking local en el dispositivo.
--
-- IMPORTANTE: se ELIMINA la versión de 3 argumentos. Un create or
-- replace con la firma nueva dejaría viva la vieja (sin token), que
-- sigue concedida a anon y reabre el agujero entero.
drop function if exists public.submit_score(text, int, text);

create or replace function public.submit_score(
  p_name text, p_token text, p_meters int, p_mode text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select a.name into v_name
    from public.accounts a
    where a.name_lower = lower(coalesce(p_name, ''))
      and a.session_token = p_token;
  if v_name is null then
    raise exception 'no_autorizado';
  end if;

  -- Segunda barrera: una cuenta creada ANTES de que existiera el filtro
  -- del servidor puede tener un apodo ofensivo. Que siga jugando, pero
  -- no llega a la tabla pública.
  if not public.is_name_allowed(v_name) then
    return;
  end if;

  insert into public.scores (name, meters, mode)
  values (v_name, p_meters, p_mode)
  on conflict ((lower(name)), mode)
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
grant execute on function public.submit_score(text, text, int, text) to anon;
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
-- p_create declara la INTENCIÓN del jugador y es lo que permite dar el
-- error correcto en vez de adivinar:
--   true  (crear cuenta) → si el nombre existe: nombre_ya_existe.
--   false (ingresar)     → si el nombre no existe: cuenta_no_existe.
--   null  (compatibilidad) → comportamiento antiguo: crea si no existe.
--
-- Sin esto, un jugador que se equivoca al teclear su nombre no recibía
-- un error: recibía una cuenta NUEVA y vacía, sin sus monedas, sus
-- skins ni sus récords, y sin ninguna pista de qué había pasado. Y
-- quien intentaba registrarse con un nombre ya tomado recibía
-- "pin_incorrecto", que no significa nada para quien no estaba
-- iniciando sesión.
--
-- La firma de 2 argumentos SE CONSERVA como compatibilidad (abajo),
-- al revés que en submit_score. Ahí la versión vieja era el agujero de
-- seguridad y había que eliminarla; aquí la vieja autentica igual de
-- bien, solo es ambigua, y las apps Android ya instaladas llevan el JS
-- empaquetado: eliminarla las dejaría sin poder iniciar sesión. Se
-- puede quitar cuando el parque de instalaciones esté actualizado.
create or replace function public.auth_account(
  p_name text, p_pin text, p_create boolean
)
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
    -- Venía a REGISTRARSE y el nombre ya está tomado. Se avisa como tal,
    -- sin tocar el contador de intentos fallidos: no es un PIN errado,
    -- así que no debe acercar a nadie al bloqueo de la cuenta ajena.
    if p_create then
      return jsonb_build_object('error', 'nombre_ya_existe');
    end if;

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
    -- Venía a INGRESAR y la cuenta no existe: se avisa, en vez de
    -- crearla en silencio. Este era el caso del nombre mal tecleado,
    -- que dejaba al jugador dentro de una cuenta vacía creyendo haber
    -- perdido su progreso. "is false" y no "not p_create": con null
    -- (llamada antigua de 2 argumentos) hay que seguir creando.
    if p_create is false then
      return jsonb_build_object('error', 'cuenta_no_existe');
    end if;

    -- El filtro de apodos se aplica solo al CREAR. Comprobarlo también
    -- al entrar dejaría a una cuenta antigua con nombre ofensivo sin
    -- acceso a su propio progreso; para esas, la barrera está en
    -- submit_score (no llegan al ranking público, pero siguen jugando).
    if not public.is_name_allowed(v_name) then
      return jsonb_build_object('error', 'nombre_invalido');
    end if;
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

-- Sincroniza el progreso local con el remoto. p_token debe coincidir
-- con el de auth_account.
--
-- MONEDAS: autoritativas del cliente (se guarda p_coins tal cual). NO
-- se puede usar greatest(server, cliente): romperia el gasto, porque
-- al comprar una skin el cliente sube un saldo MENOR y greatest
-- conservaria el viejo, "reembolsando" la compra (el cliente lo
-- adopta con setBalance y recupera lo gastado -> skins gratis). El
-- precio es que, si se juega la MISMA cuenta en dos dispositivos, el
-- ultimo en sincronizar manda; para un juego casual de un dispositivo
-- es el comportamiento correcto.
-- SKINS: union (nunca se pierde una skin ya comprada, en cualquier
-- dispositivo).
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

-- Borra la cuenta y TODOS sus datos asociados (para el requisito de
-- Google Play de un flujo de eliminación de cuenta self-service, ver
-- delete-account.html). Requiere el PIN correcto para evitar que
-- cualquiera borre la cuenta de otro con solo saber el nombre.
-- Comparte el mismo bloqueo por intentos fallidos que auth_account
-- (incrementa/consulta el mismo failed_attempts/locked_until): es el
-- mismo secreto (el PIN), así que la protección contra fuerza bruta
-- debe ser una sola, no dos contadores independientes.
create or replace function public.delete_account(p_name text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.accounts;
  v_max_attempts constant int := 5;
  v_lockout_seconds constant int := 300;
  v_base_attempts int;
  v_new_attempts int;
  v_remaining int;
begin
  select * into v_row from public.accounts
    where name_lower = lower(trim(p_name)) for update;

  if not found then
    return jsonb_build_object('error', 'no_encontrada');
  end if;

  if v_row.locked_until is not null and v_row.locked_until > now() then
    v_remaining := ceil(extract(epoch from (v_row.locked_until - now())));
    return jsonb_build_object('error', 'cuenta_bloqueada', 'retryAfter', v_remaining);
  end if;

  if v_row.pin_hash <> crypt(p_pin, v_row.pin_hash) then
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

  -- PIN correcto: borra el ranking mundial asociado y la cuenta.
  delete from public.scores where lower(name) = lower(v_row.name);
  delete from public.accounts where id = v_row.id;

  return jsonb_build_object('ok', true);
end;
$$;

-- Compatibilidad con las apps ya instaladas, que llevan el JS
-- empaquetado y siguen llamando con 2 argumentos. Delega con
-- p_create = null, es decir el comportamiento de siempre: crear la
-- cuenta si el nombre no existe. Eliminar cuando el parque de
-- instalaciones esté actualizado.
create or replace function public.auth_account(p_name text, p_pin text)
returns jsonb
language sql
as $$
  select public.auth_account(p_name, p_pin, null::boolean);
$$;

grant execute on function public.auth_account(text, text) to anon;
grant execute on function public.auth_account(text, text, boolean) to anon;
grant execute on function public.sync_account(text, text, int, jsonb, text) to anon;
grant execute on function public.delete_account(text, text) to anon;

-- ============================================================
-- Códigos de regalo (canje de monedas). Repartes un código a la
-- comunidad y cada CUENTA puede canjearlo UNA sola vez. RLS bloquea
-- todo acceso directo del cliente a las dos tablas: solo la función
-- redeem_code (SECURITY DEFINER) las toca, así nadie puede leer los
-- códigos ni darse monedas saltándose la validación.
-- ============================================================

-- Catálogo de códigos. Insertas filas aquí para crear códigos nuevos
-- (ver el ejemplo al final). El código se compara SIN distinguir
-- mayúsculas, así que "VERANO2026" y "verano2026" son el mismo.
-- Recomendación: usa códigos largos y aleatorios (8+ caracteres) para
-- que nadie los adivine probando al azar.
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

-- Ejemplo: crear un código "BIENVENIDA" que da 500 monedas, sin tope
-- ni vencimiento. Descomenta y ejecuta cuando quieras crear uno.
-- insert into public.redeem_codes (code, coins) values ('BIENVENIDA', 500);
--
-- Con tope de 100 canjes y vencimiento el 31 de diciembre de 2026:
-- insert into public.redeem_codes (code, coins, max_total, expires_at)
-- values ('VERANO2026', 1000, 100, '2026-12-31 23:59:59+00');

-- ============================================================
-- Anuncios recompensados (AdMob): contador de vistas por cuenta.
-- Solo cuentan los anuncios RECOMPENSADOS que el jugador eligió ver
-- (revivir o monedas), nunca el banner pasivo. El tope diario y el
-- desbloqueo de la skin épica se calculan y aplican en el SERVIDOR
-- (no en localStorage), para que no se puedan falsear desde el
-- cliente. El conteo vive en accounts (una cuenta = un contador, como
-- coins/skins_owned), no hace falta una tabla aparte.
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
