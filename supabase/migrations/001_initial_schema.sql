-- Enable pgvector extension for semantic search
create extension if not exists vector;

-- ──────────────────────────────────────────────
-- USERS
-- ──────────────────────────────────────────────
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  dietary_restrictions  text[]   not null default '{}',
  skill_level   text             not null default 'beginner',
  equipment     text[]           not null default '{}',
  created_at    timestamptz      not null default now(),
  updated_at    timestamptz      not null default now()
);

alter table public.users enable row level security;

create policy "Users can read own profile"
  on public.users for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update using (auth.uid() = id);

-- Auto-create user row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ──────────────────────────────────────────────
-- COOKING SESSIONS
-- ──────────────────────────────────────────────
create table if not exists public.cooking_sessions (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references public.users(id) on delete cascade,
  recipe_name          text,
  summary              text,
  embedding            vector(768),   -- Gemini text-embedding-004 dimension
  duration_seconds     int          not null default 0,
  completion_percentage int         not null default 0 check (completion_percentage between 0 and 100),
  created_at           timestamptz  not null default now()
);

create index on public.cooking_sessions (user_id, created_at desc);
-- HNSW index for fast approximate nearest-neighbour search
create index on public.cooking_sessions
  using hnsw (embedding vector_cosine_ops);

alter table public.cooking_sessions enable row level security;

create policy "Users can manage own sessions"
  on public.cooking_sessions for all using (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- RECIPE STEPS
-- ──────────────────────────────────────────────
create table if not exists public.recipe_steps (
  id          uuid        primary key default gen_random_uuid(),
  session_id  uuid        not null references public.cooking_sessions(id) on delete cascade,
  user_id     uuid        not null references public.users(id) on delete cascade,
  step_number int         not null,
  step_name   text,
  skipped     boolean     not null default false,
  struggled   boolean     not null default false,
  duration_seconds int,
  created_at  timestamptz not null default now()
);

alter table public.recipe_steps enable row level security;

create policy "Users can manage own steps"
  on public.recipe_steps for all using (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- INGREDIENTS USED
-- ──────────────────────────────────────────────
create table if not exists public.ingredients_used (
  id           uuid        primary key default gen_random_uuid(),
  session_id   uuid        not null references public.cooking_sessions(id) on delete cascade,
  user_id      uuid        not null references public.users(id) on delete cascade,
  ingredient   text        not null,
  quantity     text,
  substitution text,
  created_at   timestamptz not null default now()
);

alter table public.ingredients_used enable row level security;

create policy "Users can manage own ingredients"
  on public.ingredients_used for all using (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- USER NOTES (persistent coaching memory)
-- ──────────────────────────────────────────────
create table if not exists public.user_notes (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.users(id) on delete cascade,
  note       text        not null,
  created_at timestamptz not null default now()
);

alter table public.user_notes enable row level security;

create policy "Users can manage own notes"
  on public.user_notes for all using (auth.uid() = user_id);

-- ──────────────────────────────────────────────
-- SEMANTIC SEARCH FUNCTION
-- Called by the backend: match_cooking_sessions(query_embedding, user_id, count)
-- ──────────────────────────────────────────────
create or replace function public.match_cooking_sessions(
  query_embedding vector(768),
  match_user_id   uuid,
  match_count     int default 3
)
returns table (
  id          uuid,
  recipe_name text,
  summary     text,
  similarity  float
)
language sql stable as $$
  select
    cs.id,
    cs.recipe_name,
    cs.summary,
    1 - (cs.embedding <=> query_embedding) as similarity
  from public.cooking_sessions cs
  where cs.user_id = match_user_id
    and cs.embedding is not null
  order by cs.embedding <=> query_embedding
  limit match_count;
$$;
