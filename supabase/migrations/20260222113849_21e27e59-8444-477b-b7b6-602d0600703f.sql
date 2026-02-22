UPDATE site_settings 
SET value = '{"status":"idle","timestamp":0}', updated_at = now()
WHERE key = 'sync_result';