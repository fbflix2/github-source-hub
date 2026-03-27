-- Fix track_days to match actual number of tasks for each profile
UPDATE warming_profiles wp
SET track_days = (
  SELECT COUNT(*) FROM warming_tasks wt WHERE wt.profile_id = wp.id
)
WHERE (SELECT COUNT(*) FROM warming_tasks wt WHERE wt.profile_id = wp.id) > 0
AND track_days != (SELECT COUNT(*) FROM warming_tasks wt WHERE wt.profile_id = wp.id);