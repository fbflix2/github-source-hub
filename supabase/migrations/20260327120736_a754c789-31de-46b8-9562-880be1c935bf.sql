-- For profiles with duplicate day_numbers, keep only the newest task per day_number
-- This handles cases where both old and new tasks are incomplete
DELETE FROM warming_tasks
WHERE id IN (
  SELECT wt.id
  FROM warming_tasks wt
  JOIN (
    SELECT profile_id, day_number, MAX(created_at) as latest_created
    FROM warming_tasks
    GROUP BY profile_id, day_number
    HAVING COUNT(*) > 1
  ) dupes ON dupes.profile_id = wt.profile_id 
    AND dupes.day_number = wt.day_number 
    AND wt.created_at < dupes.latest_created
);

-- Also delete any tasks with day_number exceeding the track's expected range
-- based on track_type (not track_days, since that was already synced)
DELETE FROM warming_tasks
WHERE id IN (
  SELECT wt.id
  FROM warming_tasks wt
  JOIN warming_profiles wp ON wp.id = wt.profile_id
  WHERE (wp.track_type = '7_days' AND wt.day_number > 7)
     OR (wp.track_type = '15_days' AND wt.day_number > 15)
     OR (wp.track_type = '30_days' AND wt.day_number > 30)
);

-- Re-sync track_days to actual task count
UPDATE warming_profiles wp
SET track_days = (
  SELECT COUNT(*) FROM warming_tasks wt WHERE wt.profile_id = wp.id
)
WHERE (SELECT COUNT(*) FROM warming_tasks wt WHERE wt.profile_id = wp.id) > 0
AND track_days != (SELECT COUNT(*) FROM warming_tasks wt WHERE wt.profile_id = wp.id);