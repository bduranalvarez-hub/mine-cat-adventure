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
