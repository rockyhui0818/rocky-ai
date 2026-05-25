create extension if not exists pgcrypto;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  name text not null,
  role text not null default 'operator',
  status text not null default 'active',
  quota integer not null default 120,
  used integer not null default 0,
  platforms jsonb not null default '["amazon","mercado","tiktok","shopee","all"]'::jsonb,
  models jsonb not null default '["openai"]'::jsonb,
  created_by uuid references public.accounts(id),
  created_at timestamptz not null default now()
);

create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  type text not null default 'generate',
  action text not null,
  platform text not null default 'all',
  model text not null default 'openai',
  units integer not null default 1,
  tokens integer not null default 0,
  success boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_logs_account_created_idx on public.usage_logs(account_id, created_at desc);

insert into public.accounts (username, password_hash, name, role, status, quota, used, platforms, models)
values
  (
    'admin',
    '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    '主管理员',
    'owner',
    'active',
    9999,
    0,
    '["amazon","mercado","tiktok","shopee","all"]'::jsonb,
    '["openai","gemini","claude","local","manual"]'::jsonb
  ),
  (
    'creative-a',
    'b742dbd85f476ba78151f62224eeff1ed0dca9f05160dbfeb76e54c47dfd340a',
    '设计子账号 A',
    'designer',
    'active',
    300,
    0,
    '["amazon","mercado","all"]'::jsonb,
    '["openai","manual"]'::jsonb
  ),
  (
    'ops-b',
    '362e4f232c0f2fb110ac652338b3f20d2b99db1e7c012b7eb3382f27a3086251',
    '运营子账号 B',
    'operator',
    'active',
    180,
    0,
    '["mercado","shopee","tiktok","all"]'::jsonb,
    '["openai","gemini","manual"]'::jsonb
  ),
  (
    'review-c',
    '7ad8ef4141484d807e3b171c42f49110f799cfe5ab79b01cbce28387603f806f',
    '审核子账号 C',
    'reviewer',
    'paused',
    90,
    0,
    '["amazon","all"]'::jsonb,
    '["openai","manual"]'::jsonb
  )
on conflict (username) do nothing;
