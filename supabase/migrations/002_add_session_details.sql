-- Add structured session details (steps, highlights, tips) to cooking_sessions
alter table public.cooking_sessions
  add column if not exists details jsonb;
