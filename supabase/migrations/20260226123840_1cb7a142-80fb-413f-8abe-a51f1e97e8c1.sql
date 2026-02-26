
-- Link known subscriptions to their clients based on spreadsheet data
-- 2602263003 -> aldopaesano4@gmail.com
UPDATE subscriptions SET user_id = '84c038f1-ab45-4e3f-843f-51aa6f7de4cb' 
WHERE name = '2602263003' AND user_id = '51d84540-066d-4f6d-b06b-a4c6156474c3';

-- 2602262155 -> cleysson.sb@gmail.com  
UPDATE subscriptions SET user_id = 'ceb5e4b4-85b3-4065-b918-ff40c42a1515'
WHERE name = '2602262155' AND user_id = '51d84540-066d-4f6d-b06b-a4c6156474c3';

-- 2602268604 -> also aldopaesano (was in spreadsheet but need to verify)
-- Check all remaining codes against all client emails via the spreadsheet data already imported
-- These are the codes from the spreadsheet that should be linked:

-- Link 2602259767, 2602251425, 2602253733, 2602255677, 2602252611, 2602246597, 2602241237 -> aldopaesano
UPDATE subscriptions SET user_id = '84c038f1-ab45-4e3f-843f-51aa6f7de4cb'
WHERE name IN ('2602259767','2602251425','2602253733','2602255677','2602252611','2602246597','2602241237')
AND user_id = '51d84540-066d-4f6d-b06b-a4c6156474c3';
