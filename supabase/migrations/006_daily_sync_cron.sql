-- Enable pg_cron and pg_net extensions for scheduled HTTP calls
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Schedule daily balance refresh at 7:00 AM UTC (midnight PST)
-- This calls the refresh-balances edge function which:
-- 1. Refreshes Plaid account balances (FREE /accounts/get endpoint)
-- 2. Saves a net_worth_snapshot for the day
select cron.schedule(
  'daily-balance-sync',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://hltlkducmjmypnbvaizx.supabase.co/functions/v1/refresh-balances',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsdGxrZHVjbWpteXBuYnZhaXp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzNDc5NTYsImV4cCI6MjA1OTkyMzk1Nn0.QLPbmFEsMOY16MdhOCOqzM7_MqhZCf6xcaLU8IcmOPU'
    ),
    body := '{}'::jsonb
  );
  $$
);
