-- Run once in Supabase SQL Editor. No service-role key is used by the app.
begin;
create table if not exists public.pt_customer_memory (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id text not null check (customer_id ~ '^CUST[0-9]{5}$'),
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner_id, customer_id)
);
create table if not exists public.pt_bank_snapshots (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  customer_id text not null check (customer_id ~ '^CUST[0-9]{5}$'),
  payload jsonb not null check (payload->'customer'->>'id' = customer_id),
  updated_at timestamptz not null default now(),
  primary key (owner_id, customer_id)
);
alter table public.pt_customer_memory enable row level security;
alter table public.pt_bank_snapshots enable row level security;
revoke all on public.pt_customer_memory, public.pt_bank_snapshots from anon;
grant select, insert, update, delete on public.pt_customer_memory, public.pt_bank_snapshots to authenticated;
create policy "Own customer memory" on public.pt_customer_memory for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Own bank snapshots" on public.pt_bank_snapshots for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create or replace function public.pt_save_memory(p_customer_id text, p_state jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  old_state jsonb;
  chosen jsonb;
  merged_messages jsonb;
  reset_time bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_state->'messages') is distinct from 'array' then raise exception 'messages must be an array'; end if;
  -- Insert + row lock serializes concurrent first writes as well as subsequent ones.
  insert into public.pt_customer_memory(owner_id, customer_id) values (auth.uid(), p_customer_id)
    on conflict (owner_id, customer_id) do nothing;
  select state into old_state from public.pt_customer_memory
    where owner_id = auth.uid() and customer_id = p_customer_id for update;
  reset_time := greatest(coalesce((old_state->>'resetAt')::bigint, 0), coalesce((p_state->>'resetAt')::bigint, 0));
  chosen := case
    when coalesce((p_state->>'resetAt')::bigint, 0) > coalesce((old_state->>'resetAt')::bigint, 0) then p_state
    when coalesce((p_state->>'resetAt')::bigint, 0) < coalesce((old_state->>'resetAt')::bigint, 0) then old_state
    when coalesce((p_state->>'updatedAt')::bigint, 0) >= coalesce((old_state->>'updatedAt')::bigint, 0) then p_state else old_state end;
  select coalesce(jsonb_agg(item order by (item->>'ts')::bigint, item->>'id'), '[]'::jsonb)
    into merged_messages from (
      select distinct on (item->>'id') item from jsonb_array_elements(
        coalesce(old_state->'messages', '[]'::jsonb) || (p_state->'messages')
      ) as t(item)
      where (item->>'ts')::bigint > reset_time
      order by item->>'id', (item->>'ts')::bigint desc
    ) unique_messages;
  update public.pt_customer_memory set
    state = chosen || jsonb_build_object('messages', merged_messages, 'resetAt', reset_time), updated_at = now()
    where owner_id = auth.uid() and customer_id = p_customer_id;
end;
$$;
revoke all on function public.pt_save_memory(text, jsonb) from public, anon;
grant execute on function public.pt_save_memory(text, jsonb) to authenticated;
commit;
