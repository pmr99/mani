-- Plaid Items: stores access tokens per linked institution
create table plaid_items (
  id uuid primary key default gen_random_uuid(),
  access_token text not null,
  institution_id text not null,
  institution_name text not null,
  cursor text,
  created_at timestamptz default now()
);

-- Accounts: bank accounts from Plaid
create table accounts (
  id uuid primary key default gen_random_uuid(),
  plaid_item_id uuid references plaid_items(id) on delete cascade,
  plaid_account_id text not null unique,
  name text not null,
  type text not null,
  subtype text,
  mask text,
  current_balance numeric,
  available_balance numeric,
  updated_at timestamptz default now()
);

-- Transactions
create table transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  plaid_transaction_id text not null unique,
  amount numeric not null,
  date date not null,
  name text not null,
  merchant_name text,
  category text,
  pending boolean default false,
  created_at timestamptz default now()
);

-- Budgets
create table budgets (
  id uuid primary key default gen_random_uuid(),
  category text not null unique,
  monthly_limit numeric not null,
  created_at timestamptz default now()
);

-- Indexes for common queries
create index idx_transactions_date on transactions(date desc);
create index idx_transactions_category on transactions(category);
create index idx_transactions_account on transactions(account_id);
create index idx_accounts_plaid_item on accounts(plaid_item_id);

-- Enable RLS (no policies needed for single-user personal use,
-- but we enable it so it's ready if auth is added later)
alter table plaid_items enable row level security;
alter table accounts enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;

-- Allow all operations for anon key (single-user app)
create policy "allow_all" on plaid_items for all using (true) with check (true);
create policy "allow_all" on accounts for all using (true) with check (true);
create policy "allow_all" on transactions for all using (true) with check (true);
create policy "allow_all" on budgets for all using (true) with check (true);
