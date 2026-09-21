-- Private, append-only recovery snapshots. Credentials never belong in payloads.
create table if not exists public.workspace_revisions (
  revision_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id text not null,
  modified_at timestamptz not null,
  received_at timestamptz not null default now(),
  record jsonb not null check (jsonb_typeof(record) = 'object'),
  check (not (record ?| array['apiKey','youtubeKey','key','access_token','refresh_token']))
);
create index if not exists workspace_revisions_owner_latest on public.workspace_revisions(user_id, workspace_id, modified_at desc, received_at desc);
alter table public.workspace_revisions enable row level security;
revoke all on public.workspace_revisions from anon, authenticated;
grant select, insert on public.workspace_revisions to authenticated;
create policy "Read own workspace revisions" on public.workspace_revisions for select to authenticated using ((select auth.uid()) = user_id);
create policy "Append own workspace revisions" on public.workspace_revisions for insert to authenticated with check ((select auth.uid()) = user_id);

create table if not exists public.fact_memory (
  user_id uuid not null references auth.users(id) on delete cascade,
  fact_id text not null,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  known boolean not null default false,
  fingerprint text not null,
  primary key (user_id, fact_id),
  unique (user_id, fingerprint)
);
alter table public.fact_memory enable row level security;
revoke all on public.fact_memory from anon, authenticated;
grant select, insert, update on public.fact_memory to authenticated;
create policy "Read own fact memory" on public.fact_memory for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own fact memory" on public.fact_memory for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own fact memory" on public.fact_memory for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.latest_workspace_revisions()
returns setof public.workspace_revisions language sql stable security invoker set search_path = '' as $$
  select distinct on (workspace_id) * from public.workspace_revisions
  where user_id = (select auth.uid())
  order by workspace_id, modified_at desc, received_at desc;
$$;
revoke all on function public.latest_workspace_revisions() from public, anon;
grant execute on function public.latest_workspace_revisions() to authenticated;

create or replace function public.remember_facts(items jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in before syncing'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 100 then raise exception 'Invalid fact batch'; end if;
  insert into public.fact_memory (user_id, fact_id, content, fingerprint, known)
  select auth.uid(),
         value->>'id',
         value - 'known' - 'fingerprint',
         coalesce(nullif(value->>'fingerprint', ''), value->>'id'),
         coalesce((value->>'known')::boolean, false)
  from jsonb_array_elements(items)
  where length(value->>'id') > 0
    and length(coalesce(nullif(value->>'fingerprint', ''), value->>'id')) > 0
  on conflict (user_id, fingerprint) do update set
    content = excluded.content,
    known = public.fact_memory.known or excluded.known;
end;
$$;
revoke all on function public.remember_facts(jsonb) from public, anon;
grant execute on function public.remember_facts(jsonb) to authenticated;
