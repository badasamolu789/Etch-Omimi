-- Fix signup profile creation when Row Level Security blocks browser inserts.
-- Run this in the Supabase SQL Editor for an existing Etch project.

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role public.user_role not null default 'buyer';
alter table public.profiles add column if not exists full_name text not null default 'Etch user';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists company text;
alter table public.profiles add column if not exists creative_need text;
alter table public.profiles add column if not exists budget_range text;
alter table public.profiles add column if not exists preferred_categories text;
alter table public.profiles add column if not exists studio_name text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists specialization text;
alter table public.profiles add column if not exists portfolio_link text;
alter table public.profiles add column if not exists onboarding_complete boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.user_role;
  requested_name text;
begin
  requested_role :=
    case
      when new.raw_user_meta_data->>'role' in ('buyer', 'creator', 'admin')
        then (new.raw_user_meta_data->>'role')::public.user_role
      else 'buyer'::public.user_role
    end;

  requested_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');

  begin
    insert into public.profiles (id, email, role, full_name, onboarding_complete)
    values (
      new.id,
      coalesce(new.email, ''),
      requested_role,
      coalesce(requested_name, split_part(coalesce(new.email, 'Etch user'), '@', 1), 'Etch user'),
      false
    )
    on conflict do nothing;
  exception
    when others then
      raise warning 'Etch profile creation skipped for auth user %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email, role, full_name, onboarding_complete)
select
  u.id,
  coalesce(u.email, ''),
  case
    when u.raw_user_meta_data->>'role' in ('buyer', 'creator', 'admin')
      then (u.raw_user_meta_data->>'role')::public.user_role
    else 'buyer'::public.user_role
  end,
  coalesce(
    nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', '')), ''),
    split_part(coalesce(u.email, 'Etch user'), '@', 1),
    'Etch user'
  ),
  false
from auth.users as u
where not exists (
  select 1 from public.profiles
  where profiles.id = u.id or profiles.email = coalesce(u.email, '')
)
on conflict do nothing;
