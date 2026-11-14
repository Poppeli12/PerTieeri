-- Julkisen demon OpenAI-kustannusten hallinta: agenttikutsut lasketaan käyttäjä- ja päiväkohtaisesti.
-- Vain pilvifunktio (service role) kirjoittaa/lukee. Sovelluksen avaimilla (anon / authenticated) ei pääsyä.
begin;
create table if not exists public.pt_ai_usage (
  user_id uuid not null,
  day date not null default (now() at time zone 'Europe/Helsinki')::date,
  calls integer not null default 0,
  primary key (user_id, day)
);
alter table public.pt_ai_usage enable row level security;
revoke all on public.pt_ai_usage from anon, authenticated;

-- Varaa yksi kutsu atomisesti. Palauttaa 'ok', 'user_limit' tai 'global_limit'.
create or replace function public.pt_ai_take(p_user uuid, p_user_limit integer, p_global_limit integer)
returns text language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Europe/Helsinki')::date;
  mine integer;
  total integer;
begin
  -- yksi lukko kerrallaan päivän kokonaismäärälle (ei kilpatilanteita katon ylitykseen)
  perform pg_advisory_xact_lock(hashtext('pt_ai_take'));
  select coalesce(sum(calls), 0) into total from public.pt_ai_usage where day = today;
  if total >= p_global_limit then return 'global_limit'; end if;
  insert into public.pt_ai_usage(user_id, day, calls) values (p_user, today, 0)
    on conflict (user_id, day) do nothing;
  select calls into mine from public.pt_ai_usage where user_id = p_user and day = today for update;
  if mine >= p_user_limit then return 'user_limit'; end if;
  update public.pt_ai_usage set calls = calls + 1 where user_id = p_user and day = today;
  return 'ok';
end;
$$;
revoke all on function public.pt_ai_take(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.pt_ai_take(uuid, integer, integer) to service_role;
commit;
