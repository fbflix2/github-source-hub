
-- Allow authenticated users (operators) to read warming_quality_* and warming_notes_* settings
CREATE POLICY "Authenticated can read warming per-profile settings"
ON public.site_settings FOR SELECT
TO authenticated
USING (key LIKE 'warming_quality_%' OR key LIKE 'warming_notes_%');

CREATE POLICY "Authenticated can insert warming per-profile settings"
ON public.site_settings FOR INSERT
TO authenticated
WITH CHECK (key LIKE 'warming_quality_%' OR key LIKE 'warming_notes_%');

CREATE POLICY "Authenticated can update warming per-profile settings"
ON public.site_settings FOR UPDATE
TO authenticated
USING (key LIKE 'warming_quality_%' OR key LIKE 'warming_notes_%')
WITH CHECK (key LIKE 'warming_quality_%' OR key LIKE 'warming_notes_%');
