-- Run once in your own Supabase project SQL Editor. No existing data is deleted.
begin;
create table if not exists public.poker_tracker_sessions (
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 id text not null check (id ~ '^[a-zA-Z0-9_-]{1,100}$'),
 date date not null check (date between date '0001-01-01' and date '9999-12-31'),
 place text not null check (length(trim(place)) between 1 and 80),
 players integer not null check (players between 2 and 23),
 cents bigint not null check (cents between -99999999900 and 99999999900),
 revision integer not null default 1 check (revision>0),
 deleted boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(user_id,id)
);
alter table public.poker_tracker_sessions enable row level security;
revoke all on public.poker_tracker_sessions from anon;
grant select,insert,update on public.poker_tracker_sessions to authenticated;
drop policy if exists poker_own_select on public.poker_tracker_sessions;
create policy poker_own_select on public.poker_tracker_sessions for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists poker_own_insert on public.poker_tracker_sessions;
create policy poker_own_insert on public.poker_tracker_sessions for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists poker_own_update on public.poker_tracker_sessions;
create policy poker_own_update on public.poker_tracker_sessions for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create or replace function public.poker_tracker_snapshot() returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception '请先登录'; end if;
 return jsonb_build_object('records',coalesce((select jsonb_agg(jsonb_build_object('id',id,'date',date,'place',place,'players',players,'cents',cents,'revision',revision) order by date desc,id) from public.poker_tracker_sessions where user_id=auth.uid() and not deleted),'[]'::jsonb));
end;
$$;

create or replace function public.poker_tracker_mutate(p_method text,p_body jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r jsonb; affected integer;
begin
 if auth.uid() is null then raise exception '请先登录'; end if;
 if p_method not in ('POST','PUT','DELETE') then raise exception '不支持的操作'; end if;
 if p_method='POST' and p_body ? 'records' then
  if jsonb_typeof(p_body->'records')<>'array' then raise exception '备份格式不正确'; end if;
  if jsonb_array_length(p_body->'records')>1000 then raise exception '单次最多导入1000条'; end if;
  if (select count(*)<>count(distinct item->>'id') from jsonb_array_elements(p_body->'records') item) then raise exception '备份内编号重复或缺失'; end if;
  for r in select value from jsonb_array_elements(p_body->'records') loop
   if jsonb_typeof(r->'id')<>'string' or jsonb_typeof(r->'place')<>'string' or not ((r->>'date') ~ '^\d{4}-\d{2}-\d{2}$') or not ((r->>'players') ~ '^\d+$') or not ((r->>'cents') ~ '^-?\d+$') then raise exception '备份记录格式不正确'; end if;
   insert into public.poker_tracker_sessions(user_id,id,date,place,players,cents)
   values(auth.uid(),r->>'id',(r->>'date')::date,trim(r->>'place'),(r->>'players')::integer,(r->>'cents')::bigint)
   on conflict(user_id,id) do nothing;
  end loop;
 elsif p_method='POST' then
  insert into public.poker_tracker_sessions(user_id,id,date,place,players,cents)
  values(auth.uid(),p_body->>'id',(p_body->>'date')::date,trim(p_body->>'place'),(p_body->>'players')::integer,(p_body->>'cents')::bigint)
  on conflict(user_id,id) do nothing;
  get diagnostics affected=row_count;
  if affected=0 then raise exception '记录编号已存在，请刷新核对，避免重复保存'; end if;
 elsif p_method='PUT' then
  update public.poker_tracker_sessions set date=(p_body->>'date')::date,place=trim(p_body->>'place'),players=(p_body->>'players')::integer,cents=(p_body->>'cents')::bigint,revision=revision+1,updated_at=now()
  where user_id=auth.uid() and id=p_body->>'id' and revision=(p_body->>'revision')::integer and not deleted;
  get diagnostics affected=row_count;
  if affected=0 then raise exception '记录已被修改或删除，请刷新后重试'; end if;
 else
  update public.poker_tracker_sessions set deleted=true,revision=revision+1,updated_at=now()
  where user_id=auth.uid() and id=p_body->>'id' and revision=(p_body->>'revision')::integer and not deleted;
  get diagnostics affected=row_count;
  if affected=0 then raise exception '记录已被修改或删除，请刷新后重试'; end if;
 end if;
 return public.poker_tracker_snapshot();
end;
$$;
revoke all on function public.poker_tracker_snapshot() from public,anon;
revoke all on function public.poker_tracker_mutate(text,jsonb) from public,anon;
grant execute on function public.poker_tracker_snapshot() to authenticated;
grant execute on function public.poker_tracker_mutate(text,jsonb) to authenticated;
commit;
