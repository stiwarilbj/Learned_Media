-- Dedicated private API keys. Never include these values in workspace snapshots,
-- fact memory, exports, analytics, or OAuth user metadata. Empty values are
-- removal tombstones, so another device cannot re-import an older local key.
create table if not exists public.account_credentials (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gemini', 'youtube')),
  api_key text not null check (length(api_key) <= 4096),
  primary key (user_id, provider)
);
alter table public.account_credentials enable row level security;
revoke all on public.account_credentials from public, anon, authenticated;
grant select, insert, update on public.account_credentials to authenticated;
create policy "Read own API keys" on public.account_credentials
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Save own API keys" on public.account_credentials
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own API keys" on public.account_credentials
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
