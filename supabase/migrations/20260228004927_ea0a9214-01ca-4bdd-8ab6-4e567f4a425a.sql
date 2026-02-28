DROP POLICY "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert global notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (global = true);