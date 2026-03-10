-- Drop the old restrictive policy that only allows viewing active partners
DROP POLICY IF EXISTS "Anyone can view active partners by slug" ON public.partners;

-- Create new policy that allows anyone to view partners by slug (regardless of status)
-- This ensures partner referral links work even when partner is inactive
CREATE POLICY "Anyone can view partners by slug"
ON public.partners
FOR SELECT
TO public
USING (true);