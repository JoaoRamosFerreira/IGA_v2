create extension if not exists "pgcrypto";

-- Admin list
create table if not exists public.app_admins (
  email text primary key,
  created_at timestamptz not null default now()
);

-- User profiles with approval/suspension workflow
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null check (role in ('admin', 'user')) default 'user',
  status text not null check (status in ('pending', 'active', 'suspended')) default 'pending',
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  department text,
  division text,
  job_title text,
  manager text,
  status text,
  country text,
  location text,
  tribe text,
  worker_type text,
  employee_type text,
  slack_id text,
  is_manual_override boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner text,
  owner_email text,
  login_type text not null check (login_type in ('SSO', 'SWA', 'Empty')) default 'Empty',
  okta_id text,
  rbac_url text,
  privileged_group_ids jsonb not null default '[]'::jsonb,
  cached_user_count int,
  is_nhi_review boolean not null default false,
  is_manual_override boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('Privileged', 'Standard')),
  scope jsonb not null default '{}'::jsonb,
  status text not null check (status in ('Draft', 'Active', 'Closed', 'Overdue')) default 'Draft',
  start_date date,
  due_date date,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  reviewer_email text not null,
  delegate_email text,
  status text not null default 'Pending',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.review_items (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references public.reviews(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete cascade,
  employee_email text not null,
  reviewer_email text not null,
  item_type text not null check (item_type in ('Human', 'NHI')) default 'Human',
  okta_group text,
  status text not null check (status in ('Pending', 'Reviewed')) default 'Pending',
  decision text check (decision in ('Keep', 'Revoke')),
  notes text,
  reviewed_at timestamptz
);

create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_type text not null check (trigger_type in ('Campaign Start', 'Reminder', 'Overdue')),
  channel text not null check (channel in ('Slack', 'Email')),
  template text not null,
  days_offset int not null default 0,
  batch_summary boolean not null default false,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_logs (
  id bigint generated always as identity primary key,
  rule_id uuid references public.notification_rules(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  channel text,
  recipients jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'sent',
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id int primary key check (id = 1),
  okta_domain text,
  okta_api_token text,
  bamboohr_subdomain text,
  bamboohr_api_key text,
  slack_bot_token text,
  okta_auto_revocation_enabled boolean not null default true,
  review_retention_mode text not null default '12mo',
  review_retention_days int,
  updated_at timestamptz not null default now()
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.help_settings (
  id int primary key check (id = 1),
  widget_title text not null default 'Help',
  updated_at timestamptz not null default now()
);

insert into public.help_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.help_faq_items (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  sort_order int not null default 0,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  timestamp timestamptz not null default now(),
  actor_email text not null,
  action text not null,
  asset_name text,
  target_user text,
  decision text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.error_logs (
  id bigint generated always as identity primary key,
  timestamp timestamptz not null default now(),
  source text,
  message text not null,
  details jsonb not null default '{}'::jsonb
);
