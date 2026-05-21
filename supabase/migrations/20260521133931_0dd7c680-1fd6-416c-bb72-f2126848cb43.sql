-- Update quotas for all active proxyfbflix subscriptions of this specific user
-- Setting exchange_quota_free back to initial_exchange_quota_free (or 2 if missing)
-- and resetting exchange_count to 0 to reflect a fresh start for these items.

UPDATE subscriptions 
SET raw_data = jsonb_set(
    jsonb_set(
        jsonb_set(raw_data, '{exchange_quota_free}', raw_data->'initial_exchange_quota_free'),
        '{exchange_count}', '0'::jsonb
    ),
    '{last_exchange_notes}', '"Quota reset by admin due to IP repetition error"'::jsonb
)
WHERE user_id = '863f28e4-0854-4e07-a94a-fd5e43b63cee' 
  AND status = 'active'
  AND type = 'proxyfbflix'
  AND (raw_data->>'exchange_quota_free')::int < (raw_data->>'initial_exchange_quota_free')::int;
