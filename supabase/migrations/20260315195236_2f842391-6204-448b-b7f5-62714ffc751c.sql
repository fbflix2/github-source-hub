UPDATE subscriptions 
SET product_id = 'b20984f8-16fe-48d7-8c96-640da7f8e001'
WHERE id IN ('df54b51c-0c36-4e7b-8a2f-b52f05e5fc14', '3326078d-1619-4f4e-beac-03ca0f683897');

-- Also delete the accidental extra allocation
DELETE FROM subscriptions WHERE name = 'WS-MMS686FA';