-- Enable UUID generation.
create extension if not exists "pgcrypto";

-- Supabase Auth user profiles with admin/user role.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null check (role in ('admin', 'user')) default 'user',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admins can read all profiles"
  on public.profiles
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Auto-create a profile row when auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', null),
    coalesce(new.raw_user_meta_data ->> 'role', 'user')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  role text,
  department text,
  manager text,
  status text,
  worker_type text not null check (worker_type in ('Employee', 'Contractor')),
  slack_id text,
  hire_date date,
  end_date date
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  okta_id text,
  owner_email text,
  login_type text not null check (login_type in ('SSO', 'Local')),
  is_nhi_review boolean not null default false,
  rbac_url text,
  privileged_group_ids jsonb not null default '[]'::jsonb
);

create table if not exists public.review_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  due_date date not null,
  status text not null check (status in ('active', 'completed'))
);

create table if not exists public.review_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.review_campaigns(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  employee_email text not null,
  reviewer_email text not null,
  status text not null check (status in ('pending', 'reviewed')) default 'pending',
  decision text check (decision in ('Approved', 'Revoked')),
  notes text,
  okta_group text
);

create table if not exists public.system_settings (
  id int primary key check (id = 1),
  bamboohr_emp_subdomain text,
  bamboohr_emp_api_key text,
  bamboohr_emp_report_id text,
  bamboohr_cont_subdomain text,
  bamboohr_cont_api_key text,
  bamboohr_cont_report_id text,
  okta_domain text,
  okta_api_token text,
  slack_bot_token text,
  nhi_types jsonb not null default '[]'::jsonb
);

alter table public.system_settings
  add column if not exists nhi_types jsonb not null default '[]'::jsonb;

insert into public.system_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  "timestamp" timestamptz not null default now(),
  actor_email text not null,
  target_user text not null,
  asset_name text not null,
  action text not null,
  decision text
);
