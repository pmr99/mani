-- Investment transactions from Plaid (up to 24 months history)
create table investment_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  plaid_investment_transaction_id text not null unique,
  security_name text,
  ticker_symbol text,
  type text not null, -- buy, sell, dividend, transfer, etc.
  subtype text,
  amount numeric not null, -- total dollar amount
  quantity numeric not null default 0,
  price numeric not null default 0,
  date date not null,
  created_at timestamptz default now()
);

-- Portfolio value snapshots (daily reconstructed values per account)
create table portfolio_daily_values (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  date date not null,
  value numeric not null default 0,
  created_at timestamptz default now(),
  unique(account_id, date)
);

-- Indexes
create index idx_invest_txns_date on investment_transactions(date desc);
create index idx_invest_txns_account on investment_transactions(account_id);
create index idx_portfolio_daily_date on portfolio_daily_values(date desc);
create index idx_portfolio_daily_account on portfolio_daily_values(account_id, date);

-- RLS
alter table investment_transactions enable row level security;
alter table portfolio_daily_values enable row level security;
create policy "allow_all" on investment_transactions for all using (true) with check (true);
create policy "allow_all" on portfolio_daily_values for all using (true) with check (true);
