-- Backfill first_login_at for all users who have orders (proof of real login)
UPDATE profiles p
SET first_login_at = sub.first_order
FROM (
  SELECT user_id, MIN(created_at) as first_order
  FROM orders
  GROUP BY user_id
) sub
WHERE p.user_id = sub.user_id
AND p.first_login_at IS NULL;