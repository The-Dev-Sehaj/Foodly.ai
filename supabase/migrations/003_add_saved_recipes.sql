create table if not exists public.saved_recipes (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references public.users(id) on delete cascade,
  title        text        not null,
  description  text,
  cooking_time text,
  servings     int,
  difficulty   text,
  ingredients  jsonb       not null default '[]',
  steps        jsonb       not null default '[]',
  tips         jsonb       not null default '[]',
  query        text,
  created_at   timestamptz not null default now()
);

alter table public.saved_recipes enable row level security;

create policy "Users can manage own recipes"
  on public.saved_recipes for all using (auth.uid() = user_id);
