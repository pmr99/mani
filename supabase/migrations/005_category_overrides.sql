-- User category overrides
-- When a user recategorizes a transaction, we store the rule here.
-- Future transactions matching the same merchant get auto-recategorized.
create table category_overrides (
  id uuid primary key default gen_random_uuid(),
  merchant_pattern text not null, -- normalized merchant name to match
  original_category text,
  new_category text not null,
  created_at timestamptz default now(),
  unique(merchant_pattern)
);

create index idx_category_overrides_merchant on category_overrides(merchant_pattern);

alter table category_overrides enable row level security;
create policy "allow_all" on category_overrides for all using (true) with check (true);
