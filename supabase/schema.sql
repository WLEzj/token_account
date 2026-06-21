-- Supabase 数据表与 RLS 策略
-- 在 Supabase SQL Editor 中执行本文件，然后在前端配置 supabase-config.js。

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('expense', 'income')),
  amount_cents integer not null check (amount_cents >= 0),
  date date not null,
  transaction_at timestamptz not null default date_trunc('second', now()),
  category jsonb not null,
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budgets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  updated_at timestamptz not null default now()
);

alter table public.transactions
  add column if not exists transaction_at timestamptz not null default date_trunc('second', now());

update public.transactions
set transaction_at = date_trunc('second', created_at)
where transaction_at is null;

create unique index if not exists transactions_user_fingerprint_unique
  on public.transactions (
    user_id,
    type,
    amount_cents,
    date,
    ((category ->> 'id')),
    coalesce(note, '')
  );

alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

-- PostgREST 需要表级权限；RLS 再负责限制每个用户只能访问自己的行。
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update on public.budgets to authenticated;

drop policy if exists "Users can read own transactions" on public.transactions;
create policy "Users can read own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own transactions" on public.transactions;
create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own transactions" on public.transactions;
create policy "Users can update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own transactions" on public.transactions;
create policy "Users can delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own budget" on public.budgets;
create policy "Users can read own budget"
  on public.budgets for select
  using (auth.uid() = user_id);

drop policy if exists "Users can upsert own budget" on public.budgets;
create policy "Users can upsert own budget"
  on public.budgets for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own budget" on public.budgets;
create policy "Users can update own budget"
  on public.budgets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
