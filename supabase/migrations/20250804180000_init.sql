-- Trivia app schema
create extension if not exists "pgcrypto";

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  admin_secret text not null,
  title text not null default 'Trivia Night',
  phase text not null default 'setup'
    check (phase in ('setup', 'lobby', 'question', 'reveal', 'finished')),
  current_question_index integer not null default -1,
  question_started_at timestamptz,
  reveal_started_at timestamptz,
  default_timer_seconds integer not null default 30,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  order_index integer not null,
  question_text text not null,
  options jsonb not null,
  correct_index integer not null check (correct_index >= 0),
  timer_seconds integer,
  unique (game_id, order_index)
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  display_name text not null,
  session_token text unique not null,
  score integer not null default 0,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (game_id, display_name)
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  selected_index integer not null,
  is_correct boolean not null default false,
  answered_at timestamptz not null default now(),
  unique (question_id, participant_id)
);

create index if not exists idx_questions_game_id on public.questions(game_id);
create index if not exists idx_participants_game_id on public.participants(game_id);
create index if not exists idx_answers_question_id on public.answers(question_id);

alter table public.games enable row level security;
alter table public.questions enable row level security;
alter table public.participants enable row level security;
alter table public.answers enable row level security;

create policy "games_select" on public.games for select using (true);
create policy "questions_select" on public.questions for select using (true);
create policy "participants_select" on public.participants for select using (true);
create policy "answers_select" on public.answers for select using (true);

alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.answers;
