
-- Add task_id column to operator_earnings for per-task earnings
ALTER TABLE public.operator_earnings
ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.warming_tasks(id) ON DELETE SET NULL;

-- Add unique constraint to prevent duplicate earnings per task
ALTER TABLE public.operator_earnings
ADD CONSTRAINT operator_earnings_task_id_unique UNIQUE (task_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_operator_earnings_task_id ON public.operator_earnings(task_id);
CREATE INDEX IF NOT EXISTS idx_operator_earnings_profile_id ON public.operator_earnings(profile_id);
