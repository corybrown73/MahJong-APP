-- Báhay online rooms.
--
-- A room row holds the *whole* game, including every player's concealed tiles
-- and the wall order. No client may ever read it: row-level security is on
-- with no policies granting anon or authenticated anything, so the only way in
-- is the Edge Function running with the service role, which answers each
-- player with their own filtered view.

create table if not exists public.bahay_rooms (
  code        text primary key,
  state       jsonb       not null,
  version     integer     not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists bahay_rooms_updated_at_idx on public.bahay_rooms (updated_at);

alter table public.bahay_rooms enable row level security;

-- Deliberately no policies. anon and authenticated get nothing; the service
-- role bypasses RLS. If you ever add a policy here, remember the row contains
-- tiles that would let a player see every other hand at the table.

revoke all on public.bahay_rooms from anon, authenticated;

comment on table public.bahay_rooms is
  'Authoritative Báhay game state. Server-only: never expose to clients.';
