-- Clean up duplicate/old tasks for profiles that were promoted
-- For profiles on 15_days track: keep only tasks with day_number 1-15, delete extras
-- For profiles on 30_days track: keep only tasks with day_number 1-30, delete extras
-- But actually, the issue is there are DUPLICATE day_numbers (old track tasks + new track tasks)
-- We need to keep only the LATEST set of tasks (the ones for the current track)

-- For profiles that have more tasks than their track_days, delete the OLDEST tasks (completed ones from previous tracks)
-- Strategy: For each profile with duplicates, keep only the most recent tasks per day_number

-- Step 1: Delete old completed tasks from previous tracks for 15_days profiles
DELETE FROM warming_tasks 
WHERE id IN (
  SELECT wt.id FROM warming_tasks wt
  JOIN warming_profiles wp ON wp.id = wt.profile_id
  WHERE wp.track_type = '15_days'
  AND wt.completed = true
  AND wt.day_number <= 7
  AND EXISTS (
    SELECT 1 FROM warming_tasks wt2 
    WHERE wt2.profile_id = wt.profile_id 
    AND wt2.day_number = wt.day_number 
    AND wt2.id != wt.id
    AND wt2.completed = false
  )
);

-- Step 2: Delete old completed tasks from previous tracks for 30_days profiles
-- These may have leftover tasks from 7_days AND 15_days tracks
DELETE FROM warming_tasks 
WHERE id IN (
  SELECT wt.id FROM warming_tasks wt
  JOIN warming_profiles wp ON wp.id = wt.profile_id
  WHERE wp.track_type = '30_days'
  AND wt.completed = true
  AND EXISTS (
    SELECT 1 FROM warming_tasks wt2 
    WHERE wt2.profile_id = wt.profile_id 
    AND wt2.day_number = wt.day_number 
    AND wt2.id != wt.id
    AND wt2.completed = false
  )
);

-- Step 3: For any remaining profiles with too many tasks, keep only track_days worth
-- Delete tasks beyond the expected count, keeping the newest ones
DELETE FROM warming_tasks
WHERE id IN (
  SELECT wt.id
  FROM warming_tasks wt
  JOIN warming_profiles wp ON wp.id = wt.profile_id
  WHERE wt.day_number > wp.track_days
);

-- Step 4: Fix track_days to match actual track definitions
UPDATE warming_profiles SET track_days = 7 WHERE track_type = '7_days' AND track_days != 7;
UPDATE warming_profiles SET track_days = 15 WHERE track_type = '15_days' AND track_days != 15;
UPDATE warming_profiles SET track_days = 30 WHERE track_type = '30_days' AND track_days != 30;