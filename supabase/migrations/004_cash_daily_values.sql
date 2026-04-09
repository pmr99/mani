-- Daily cash balance values (reconstructed from transactions)
create table cash_daily_values (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  date date not null,
  value numeric not null default 0,
  created_at timestamptz default now(),
  unique(account_id, date)
);

create index idx_cash_daily_date on cash_daily_values(date desc);
create index idx_cash_daily_account on cash_daily_values(account_id, date);

alter table cash_daily_values enable row level security;
create policy "allow_all" on cash_daily_values for all using (true) with check (true);
