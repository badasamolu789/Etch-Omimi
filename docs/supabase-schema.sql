-- Etch CMS Supabase starter schema
-- Run in Supabase SQL Editor after creating the project.
-- This file is safe to rerun for existing Etch projects.

create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('buyer', 'creator', 'admin');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.listing_status as enum ('draft', 'review', 'changes_requested', 'live', 'paused', 'archived');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.inquiry_status as enum ('new', 'open', 'negotiating', 'accepted', 'declined', 'closed');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.ticket_status as enum ('new', 'open', 'waiting', 'resolved', 'closed');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.payment_status as enum ('pending', 'processing', 'paid', 'released', 'failed', 'refunded');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role public.user_role not null default 'buyer',
  full_name text not null,
  avatar_url text,
  country text,
  company text,
  creative_need text,
  budget_range text,
  preferred_categories text,
  studio_name text,
  bio text,
  specialization text,
  portfolio_link text,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  slug text unique,
  category text not null,
  description text,
  price numeric(12,2) default 0,
  currency text not null default 'USD',
  status public.listing_status not null default 'draft',
  cover_url text,
  preview_url text,
  rights_summary text,
  views_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  subject text,
  message text not null,
  status public.inquiry_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  total_amount numeric(12,2) not null default 0,
  creator_amount numeric(12,2) not null default 0,
  platform_fee numeric(12,2) not null default 0,
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  status public.payment_status not null default 'pending',
  provider_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles(id) on delete set null,
  subject text not null,
  message text not null,
  priority text not null default 'normal',
  status public.ticket_status not null default 'new',
  assigned_admin_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  audience text,
  category text,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  source text default 'website',
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists listings_touch_updated_at on public.listings;
create trigger listings_touch_updated_at before update on public.listings for each row execute function public.touch_updated_at();
drop trigger if exists inquiries_touch_updated_at on public.inquiries;
create trigger inquiries_touch_updated_at before update on public.inquiries for each row execute function public.touch_updated_at();
drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at before update on public.orders for each row execute function public.touch_updated_at();
drop trigger if exists payouts_touch_updated_at on public.payouts;
create trigger payouts_touch_updated_at before update on public.payouts for each row execute function public.touch_updated_at();
drop trigger if exists support_tickets_touch_updated_at on public.support_tickets;
create trigger support_tickets_touch_updated_at before update on public.support_tickets for each row execute function public.touch_updated_at();

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

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create index if not exists listings_owner_status_idx on public.listings(owner_id, status, updated_at desc);
create index if not exists listings_live_category_idx on public.listings(category, updated_at desc) where status = 'live';
create index if not exists inquiries_listing_status_idx on public.inquiries(listing_id, status, updated_at desc);
create index if not exists inquiries_participants_idx on public.inquiries(sender_id, recipient_id, updated_at desc);
create index if not exists orders_creator_status_idx on public.orders(creator_id, status, created_at desc);
create index if not exists payouts_creator_status_idx on public.payouts(creator_id, status, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets(status, priority, created_at desc);

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.inquiries enable row level security;
alter table public.orders enable row level security;
alter table public.payouts enable row level security;
alter table public.support_tickets enable row level security;
alter table public.contacts enable row level security;
alter table public.subscribers enable row level security;

drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert with check (id = auth.uid());
drop policy if exists "profiles update own or admin" on public.profiles;
create policy "profiles update own or admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists "live listings are public" on public.listings;
create policy "live listings are public" on public.listings
  for select using (status = 'live' or owner_id = auth.uid() or public.is_admin());
drop policy if exists "creators manage own listings" on public.listings;
create policy "creators manage own listings" on public.listings
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "inquiry participants read" on public.inquiries;
create policy "inquiry participants read" on public.inquiries
  for select using (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin());
drop policy if exists "authenticated users create inquiries" on public.inquiries;
create policy "authenticated users create inquiries" on public.inquiries
  for insert with check (sender_id = auth.uid());
drop policy if exists "participants update inquiries" on public.inquiries;
create policy "participants update inquiries" on public.inquiries
  for update using (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin())
  with check (sender_id = auth.uid() or recipient_id = auth.uid() or public.is_admin());

drop policy if exists "order participants read" on public.orders;
create policy "order participants read" on public.orders
  for select using (buyer_id = auth.uid() or creator_id = auth.uid() or public.is_admin());
drop policy if exists "admins manage orders" on public.orders;
create policy "admins manage orders" on public.orders
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "creators read own payouts" on public.payouts;
create policy "creators read own payouts" on public.payouts
  for select using (creator_id = auth.uid() or public.is_admin());
drop policy if exists "admins manage payouts" on public.payouts;
create policy "admins manage payouts" on public.payouts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ticket requester or admin read" on public.support_tickets;
create policy "ticket requester or admin read" on public.support_tickets
  for select using (requester_id = auth.uid() or assigned_admin_id = auth.uid() or public.is_admin());
drop policy if exists "authenticated users create tickets" on public.support_tickets;
create policy "authenticated users create tickets" on public.support_tickets
  for insert with check (requester_id = auth.uid() or requester_id is null);
drop policy if exists "admins update tickets" on public.support_tickets;
create policy "admins update tickets" on public.support_tickets
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "anyone can submit contacts" on public.contacts;
create policy "anyone can submit contacts" on public.contacts
  for insert with check (true);
drop policy if exists "admins read contacts" on public.contacts;
create policy "admins read contacts" on public.contacts
  for select using (public.is_admin());

drop policy if exists "anyone can subscribe" on public.subscribers;
create policy "anyone can subscribe" on public.subscribers
  for insert with check (true);
drop policy if exists "admins read subscribers" on public.subscribers;
create policy "admins read subscribers" on public.subscribers
  for select using (public.is_admin());
