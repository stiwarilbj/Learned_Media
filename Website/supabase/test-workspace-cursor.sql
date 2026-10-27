-- Isolated fixtures, all rolled back. Uses the existing invoker RPC and RLS.
begin;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000003'), ('00000000-0000-0000-0000-000000000004');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
insert into public.workspace_revisions(revision_id,user_id,workspace_id,modified_at,record)
select md5('cursor-fixture-' || n)::uuid, auth.uid(), 'w-' || lpad(n::text,5,'0'), '2026-01-01'::timestamptz,
       jsonb_build_object('id','w-' || lpad(n::text,5,'0'))
from generate_series(0,1104) n;
do $$
declare through_key text; after_key text := null; next_key text; total integer := 0; page_count integer; pages integer := 0;
begin
  select workspace_id into through_key from public.latest_workspace_revisions() order by workspace_id desc limit 1;
  if through_key <> 'w-01104' then raise exception 'wrong boundary'; end if;
  loop
    select count(*), max(workspace_id) into page_count,next_key from (
      select workspace_id from public.latest_workspace_revisions()
      where (after_key is null or workspace_id > after_key) and workspace_id <= through_key
      order by workspace_id limit 100
    ) p;
    total := total + page_count; pages := pages + 1;
    if pages = 1 then
      -- A newer head retains its cursor key; new keys on either side cannot
      -- shift later pages as they could with offset pagination.
      insert into public.workspace_revisions(revision_id,user_id,workspace_id,modified_at,record,expected_revision_id)
      values (md5('cursor-updated')::uuid,auth.uid(),'w-00150','2026-01-02','{"id":"w-00150"}',md5('cursor-fixture-150')::uuid),
             (md5('cursor-new-after')::uuid,auth.uid(),'z-new','2026-01-01','{"id":"z-new"}',null),
             (md5('cursor-new-before')::uuid,auth.uid(),'a-new','2026-01-01','{"id":"a-new"}',null);
    end if;
    exit when page_count < 100 or next_key = through_key;
    if next_key = after_key then raise exception 'cursor did not advance'; end if;
    after_key := next_key;
  end loop;
  if total <> 1105 or pages <> 12 then raise exception 'missing or repeated workspaces: %, % pages',total,pages; end if;
end;
$$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
do $$ begin
  if exists(select 1 from public.latest_workspace_revisions()) then raise exception 'account boundary leaked'; end if;
end $$;
rollback;
