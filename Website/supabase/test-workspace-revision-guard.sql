-- Run only in an isolated test database after workspace-sync.sql and the guard.
-- All fixtures roll back. Never use an existing user's ID.
begin;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into public.workspace_revisions(revision_id,user_id,workspace_id,modified_at,record,expected_revision_id)
values ('10000000-0000-0000-0000-000000000001',auth.uid(),'cas-test','2026-01-01','{"id":"cas-test","name":"initial"}',null);
insert into public.workspace_revisions(revision_id,user_id,workspace_id,modified_at,record,expected_revision_id)
values ('10000000-0000-0000-0000-000000000002',auth.uid(),'cas-test','2026-01-02','{"id":"cas-test","name":"newer"}','10000000-0000-0000-0000-000000000001');
do $$
begin
  begin
    insert into public.workspace_revisions(revision_id,user_id,workspace_id,modified_at,record,expected_revision_id)
    values ('10000000-0000-0000-0000-000000000003',auth.uid(),'cas-test','2026-01-03','{"id":"cas-test","name":"stale"}','10000000-0000-0000-0000-000000000001');
    raise exception 'stale revision was accepted';
  exception when serialization_failure then null;
  end;
  begin
    -- Legacy callers without an expectation cannot bypass the guard.
    insert into public.workspace_revisions(revision_id,user_id,workspace_id,modified_at,record)
    values ('10000000-0000-0000-0000-000000000004',auth.uid(),'cas-test','2026-01-04','{"id":"cas-test"}');
    raise exception 'legacy stale write was accepted';
  exception when serialization_failure then null;
  end;
  begin
    insert into public.workspace_revisions(revision_id,user_id,workspace_id,modified_at,record)
    values ('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002','cas-test','2026-01-05','{"id":"cas-test"}');
    raise exception 'another account write was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.workspace_revisions(revision_id,user_id,workspace_id,modified_at,record,expected_revision_id)
    values ('20000000-0000-0000-0000-000000000001',auth.uid(),'another-test','2026-01-01','{"id":"another-test"}',null),
           ('10000000-0000-0000-0000-000000000006',auth.uid(),'cas-test','2026-01-06','{"id":"cas-test"}',null);
    raise exception 'partially conflicting batch was accepted';
  exception when serialization_failure then null;
  end;
  if exists (select 1 from public.workspace_revisions where workspace_id='another-test') then raise exception 'partial batch committed'; end if;
end;
$$;
-- Retry a lost response after a newer revision: accepted exact snapshot is a no-op.
insert into public.workspace_revisions(revision_id,user_id,workspace_id,modified_at,record,expected_revision_id)
values ('10000000-0000-0000-0000-000000000001',auth.uid(),'cas-test','2026-01-01','{"id":"cas-test","name":"initial"}',null);
do $$
begin
  if (select count(*) from public.workspace_revisions where workspace_id='cas-test') <> 2 then raise exception 'unexpected revision count'; end if;
  if (select revision_id from public.latest_workspace_revisions() where workspace_id='cas-test') <> '10000000-0000-0000-0000-000000000002'::uuid then raise exception 'head rewound'; end if;
end;
$$;
rollback;
