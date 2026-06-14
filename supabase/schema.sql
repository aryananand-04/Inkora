-- Run this in the Supabase SQL editor to set up the database.

-- ── Profiles ────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique not null,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles_public_read"  on public.profiles for select using (true);
create policy "profiles_own_insert"   on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_own_update"   on public.profiles for update using (auth.uid() = id);

-- ── Game history ─────────────────────────────────────────────────────────────

create table if not exists public.game_history (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references public.profiles(id) on delete cascade,
  room_code      text     not null,
  score          int      not null default 0,
  rank           int      not null default 0,
  words_guessed  int      not null default 0,
  played_at      timestamptz default now()
);

alter table public.game_history enable row level security;

create policy "game_history_public_read" on public.game_history for select using (true);
create policy "game_history_own_insert"  on public.game_history for insert with check (auth.uid() = user_id);

-- ── Leaderboard view (top 100 by total score) ────────────────────────────────

create or replace view public.leaderboard as
  select
    p.id,
    p.username,
    count(gh.id)::int                              as games_played,
    coalesce(sum(gh.score), 0)::int                as total_score,
    coalesce(avg(gh.score), 0)::int                as avg_score,
    coalesce(sum(gh.words_guessed), 0)::int        as total_words_guessed,
    count(case when gh.rank = 1 then 1 end)::int   as wins
  from public.profiles p
  left join public.game_history gh on gh.user_id = p.id
  group by p.id, p.username
  order by total_score desc
  limit 100;
