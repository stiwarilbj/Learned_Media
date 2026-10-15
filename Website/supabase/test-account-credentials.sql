-- Transactional security verification; no fixtures remain after rollback.
begin;
insert into auth.users (id) values ('fefecafe-0000-4000-8000-000000000001'), ('fefecafe-0000-4000-8000-000000000002');
insert into public.account_credentials(user_id,provider,api_key) values
  ('fefecafe-0000-4000-8000-000000000001','gemini','fixture-gemini'),
  ('fefecafe-0000-4000-8000-000000000002','youtube','fixture-youtube');
set local role authenticated;
select set_config('request.jwt.claim.sub','fefecafe-0000-4000-8000-000000000001',true);
do $$
declare changed integer;
begin
  if (select count(*) from public.account_credentials) <> 1 then raise exception 'Cross-account read allowed'; end if;
  update public.account_credentials set api_key = 'other-account' where user_id = 'fefecafe-0000-4000-8000-000000000002';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Cross-account update allowed'; end if;
  begin
    insert into public.account_credentials values ('fefecafe-0000-4000-8000-000000000002','gemini','forbidden');
    raise exception 'Cross-account insert allowed';
  exception when insufficient_privilege then null;
  end;
  update public.account_credentials set api_key = '' where user_id = 'fefecafe-0000-4000-8000-000000000001';
  if not exists (select 1 from public.account_credentials where api_key = '') then raise exception 'Own key removal failed'; end if;
end;
$$;
set local role anon;
do $$
begin
  begin
    perform * from public.account_credentials;
    raise exception 'Anonymous key read allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
rollback;
