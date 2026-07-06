-- ============================================================
-- Mine Cat Adventure — configuración del ranking mundial
-- Pega TODO este script en Supabase: proyecto → SQL Editor → New query → Run
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

-- Índice para ordenar rápido por modo y distancia.
create index if not exists scores_mode_meters_idx
  on public.scores (mode, meters desc);

-- Seguridad a nivel de fila.
alter table public.scores enable row level security;

-- Cualquiera puede LEER el ranking (es público).
drop policy if exists "lectura publica" on public.scores;
create policy "lectura publica" on public.scores
  for select using (true);

-- Cualquiera puede INSERTAR una puntuación (enviar su marca).
-- Los CHECK de la tabla se aplican igual. NO hay políticas de
-- UPDATE ni DELETE: por defecto quedan PROHIBIDAS (nadie puede
-- modificar ni borrar marcas ajenas desde el cliente).
drop policy if exists "insertar puntuacion" on public.scores;
create policy "insertar puntuacion" on public.scores
  for insert with check (true);

-- Función del ranking: mejor marca por jugador y modo, top N.
create or replace function public.top_scores(mode_key text, max_rows int default 10)
returns table(name text, meters int)
language sql
stable
as $$
  select t.name, t.meters
  from (
    select distinct on (s.name) s.name, s.meters
    from public.scores s
    where s.mode = mode_key
    order by s.name, s.meters desc
  ) t
  order by t.meters desc
  limit max_rows
$$;

-- Permite llamar la función a usuarios anónimos (el juego).
grant execute on function public.top_scores(text, int) to anon;
