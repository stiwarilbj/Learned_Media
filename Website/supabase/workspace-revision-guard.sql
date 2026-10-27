-- Apply before releasing clients that send expected_revision_id.
-- Snapshot payloads and revision identities remain unchanged.
begin;
alter table public.workspace_revisions
  add column if not exists expected_revision_id uuid;

create or replace function public.guard_workspace_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare current_revision uuid;
begin
  if auth.uid() is null or new.user_id <> auth.uid() then
    raise exception 'Sign in before syncing' using errcode = '42501';
  end if;
  -- Serialize compare-and-insert, including two simultaneous first saves. Use
  -- the same lock for legacy writers; a missing expectation cannot bypass CAS.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.user_id::text), pg_catalog.hashtext(new.workspace_id));
  -- A lost response may be retried after another device has saved. Confirm the
  -- already accepted exact revision without inserting it or rewinding the head.
  if exists (select 1 from public.workspace_revisions r
      where r.revision_id = new.revision_id and r.user_id = new.user_id
        and r.workspace_id = new.workspace_id and r.record = new.record) then
    return null;
  end if;
  select r.revision_id into current_revision
    from public.workspace_revisions r
    where r.user_id = new.user_id and r.workspace_id = new.workspace_id
    order by r.modified_at desc, r.received_at desc limit 1;
  if current_revision is distinct from new.expected_revision_id then
    raise exception 'Workspace revision changed; reload and merge before saving'
      using errcode = '40001';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_workspace_revision() from public, anon, authenticated;
drop trigger if exists guard_workspace_revision on public.workspace_revisions;
create trigger guard_workspace_revision before insert on public.workspace_revisions
  for each row execute function public.guard_workspace_revision();
commit;
