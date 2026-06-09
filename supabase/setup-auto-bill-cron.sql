-- pg_cron setup for auto-billing
-- Runs daily at 06:00 UTC, calls the auto-bill Edge Function
-- Requires pg_cron + pg_net extensions enabled in Dashboard > Database > Extensions
--
-- Before running: replace COLLE_TA_SERVICE_ROLE_KEY_ICI with your actual service_role key
-- (Dashboard > Project Settings > API > service_role > Reveal)

SELECT cron.schedule(
  'auto-bill-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://mrvejwyvhuivmipfwlzz.supabase.co/functions/v1/auto-bill',
    headers := jsonb_build_object(
      'Authorization', 'Bearer COLLE_TA_SERVICE_ROLE_KEY_ICI',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verify the job was created
SELECT * FROM cron.job WHERE jobname = 'auto-bill-daily';

-- To remove: SELECT cron.unschedule('auto-bill-daily');
-- To run manually once:
-- SELECT net.http_post(
--   url := 'https://mrvejwyvhuivmipfwlzz.supabase.co/functions/v1/auto-bill',
--   headers := '{"Authorization":"Bearer YOUR_SERVICE_KEY","Content-Type":"application/json"}'::jsonb,
--   body := '{}'::jsonb
-- );
