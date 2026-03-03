
-- Fix Otaciano's subscription 2509222944: update with renewed data from ProxyBR
UPDATE public.subscriptions 
SET 
  end_date = '2026-04-02T10:12:00+00:00',
  status = 'active',
  updated_at = now(),
  raw_data = jsonb_set(
    jsonb_set(
      jsonb_set(
        raw_data::jsonb,
        '{status}', '"ACTIVE"'
      ),
      '{due_date}', '"2026-04-02T10:12:00.000000Z"'
    ),
    '{proxies,data,0,status}', '"USED"'
  )
WHERE name = '2509222944' AND type = 'proxybr';
