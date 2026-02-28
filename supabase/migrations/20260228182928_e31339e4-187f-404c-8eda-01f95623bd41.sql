-- Remove duplicate wallet transaction (same reference_id, 31ms apart)
-- Keep the first one (da3151d6), delete the second (8f641d24)
DELETE FROM wallet_transactions 
WHERE id = '8f641d24-514f-4d61-b70b-e6dbd1aa7c1d';