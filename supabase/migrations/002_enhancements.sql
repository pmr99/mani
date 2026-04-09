-- Add last_synced_at to plaid_items
alter table plaid_items add column last_synced_at timestamptz;

-- Recurring expenses detected from transaction patterns
create table recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  merchant_name text not null,
  normalized_name text not null,
  amount numeric not null,
  amount_variance numeric default 0,
  frequency text not null, -- weekly, monthly, yearly
  interval_days integer not null,
  next_expected_date date not null,
  last_seen_date date not null,
  confidence_score numeric not null,
  is_subscription boolean default false,
  is_dismissed boolean default false,
  category text,
  account_id uuid references accounts(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Net worth snapshots (one per day)
create table net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  total_assets numeric not null default 0,
  total_liabilities numeric not null default 0,
  net_worth numeric not null default 0,
  cash_balance numeric default 0,
  investment_balance numeric default 0,
  credit_balance numeric default 0,
  loan_balance numeric default 0,
  created_at timestamptz default now()
);

-- User-defined financial goals
create table goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'general', -- retirement, house, emergency, general
  target_amount numeric not null,
  current_amount numeric not null default 0,
  deadline date,
  monthly_contribution numeric default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Investment holdings from Plaid
create table investment_holdings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  security_name text not null,
  ticker_symbol text,
  quantity numeric not null default 0,
  cost_basis numeric,
  current_value numeric not null default 0,
  asset_class text default 'other', -- stock, etf, mutual_fund, bond, cash, crypto, other
  sector text,
  updated_at timestamptz default now()
);

-- Indexes
create index idx_recurring_expenses_active on recurring_expenses(is_dismissed, next_expected_date);
create index idx_net_worth_snapshots_date on net_worth_snapshots(snapshot_date desc);
create index idx_goals_active on goals(is_active);
create index idx_investment_holdings_account on investment_holdings(account_id);

-- RLS (same open policy as existing tables)
alter table recurring_expenses enable row level security;
alter table net_worth_snapshots enable row level security;
alter table goals enable row level security;
alter table investment_holdings enable row level security;

create policy "allow_all" on recurring_expenses for all using (true) with check (true);
create policy "allow_all" on net_worth_snapshots for all using (true) with check (true);
create policy "allow_all" on goals for all using (true) with check (true);
create policy "allow_all" on investment_holdings for all using (true) with check (true);
