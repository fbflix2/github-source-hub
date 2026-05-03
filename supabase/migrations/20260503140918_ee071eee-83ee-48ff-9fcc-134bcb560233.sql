
DROP POLICY IF EXISTS "Public can read whitelisted settings" ON public.site_settings;

CREATE POLICY "Public can read whitelisted settings"
  ON public.site_settings
  FOR SELECT
  TO public
  USING (
    key = ANY (ARRAY[
      'site_config'::text,
      'landing_page_config'::text,
      'hidden_nav_links'::text,
      'tutorial_categories'::text,
      'termos_uso'::text,
      'termos_uso_updated'::text,
      'client_warming_track_config'::text,
      'warming_ready_criteria'::text,
      'imageviewer_base_template_url'::text,
      'imageviewer_positions'::text,
      'doc_identidade_template_url'::text
    ])
    OR key LIKE 'operator_display_name_%'
    OR key LIKE 'operator_cover_%'
  );
