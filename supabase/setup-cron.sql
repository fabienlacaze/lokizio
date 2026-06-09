-- ============================================
-- pg_cron setup for Lokizio iCal refresh
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================

-- Step 1: Enable pg_cron and pg_net extensions (if not already)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Schedule the Edge Function call every 2 hours
-- This uses pg_net to make an HTTP POST to the Edge Function
-- COST: 12 calls/day = ~360/month << 500K free limit
SELECT cron.schedule(
  'refresh-ical-every-2h',        -- job name
  '0 */2 * * *',                   -- every 2 hours
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/refresh-ical',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Step 3: Verify the job is scheduled
SELECT * FROM cron.job;

-- ============================================
-- COST MONITORING: Check how many times it ran
-- ============================================
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- ============================================
-- TO DISABLE (if needed):
-- SELECT cron.unschedule('refresh-ical-every-2h');
-- ============================================

-- ============================================
-- ALTERNATIVE: If app.settings are not set, use direct URL:
-- Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY
-- ============================================
/*
SELECT cron.schedule(
  'refresh-ical-every-2h',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mrvejwyvhuivmipfwlzz.supabase.co/functions/v1/refresh-ical',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
*/
