-- Tighten RLS: require authentication for all data access
-- Single-user app — just check auth.uid() IS NOT NULL (any logged-in user can access)

-- Drop all permissive "allow_all" policies
drop policy if exists "allow_all" on plaid_items;
drop policy if exists "allow_all" on accounts;
drop policy if exists "allow_all" on transactions;
drop policy if exists "allow_all" on budgets;
drop policy if exists "allow_all" on recurring_expenses;
drop policy if exists "allow_all" on net_worth_snapshots;
drop policy if exists "allow_all" on goals;
drop policy if exists "allow_all" on investment_holdings;
drop policy if exists "allow_all" on investment_transactions;
drop policy if exists "allow_all" on portfolio_daily_values;
drop policy if exists "allow_all" on cash_daily_values;
drop policy if exists "allow_all" on category_overrides;

-- Create authenticated-only policies
create policy "authenticated" on plaid_items for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated" on accounts for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated" on transactions for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated" on budgets for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated" on recurring_expenses for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated" on net_worth_snapshots for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated" on goals for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated" on investment_holdings for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated" on investment_transactions for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated" on portfolio_daily_values for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated" on cash_daily_values for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "authenticated" on category_overrides for all using (auth.uid() is not null) with check (auth.uid() is not null);
