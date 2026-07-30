-- Adds program authoring/progress support: run this once in the Supabase
-- SQL editor (or via `supabase db push`) before deploying the app code that
-- depends on it. Additive and idempotent — safe to re-run.

alter table sessions
  add column if not exists finished_at timestamptz,
  add column if not exists created_at timestamptz not null default now();

alter table programs
  add column if not exists description text;

create table if not exists program_progress (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null unique references programs(id) on delete cascade,
  completed_day_count integer not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
