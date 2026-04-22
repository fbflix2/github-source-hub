ALTER TABLE public.subscriptions 
ADD COLUMN notifications_enabled BOOLEAN NOT NULL DEFAULT true;

-- Update RLS if needed (subscriptions table usually has RLS)
-- Assuming admin can update all and users can view their own
-- We don't need to change policies if they are already broad enough for update
