-- program_progress was created without an RLS policy, so every insert/update
-- was rejected once RLS kicked in (the "new row violates row-level security
-- policy" error on Finish Session). This grants full access to the
-- `authenticated` role, matching the fact that the app is gated only by
-- Supabase auth (AuthGate) and treats any signed-in user as the sole owner
-- of their data. Safe to re-run.

alter table program_progress enable row level security;

drop policy if exists "authenticated_all" on program_progress;

create policy "authenticated_all" on program_progress
  for all
  to authenticated
  using (true)
  with check (true);
