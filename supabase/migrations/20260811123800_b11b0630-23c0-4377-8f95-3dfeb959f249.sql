DROP POLICY IF EXISTS "Public can read whitelisted settings" ON public.site_settings;
CREATE POLICY "Public can read whitelisted settings" ON public.site_settings FOR SELECT TO public USING (
  (key = ANY (ARRAY['site_config','landing_page_config','hidden_nav_links','tutorial_categories','termos_uso','termos_uso_updated','client_warming_track_config','warming_ready_criteria','imageviewer_base_template_url','imageviewer_positions','doc_identidade_template_url','store_layout_v2','store_v2_headline','store_v2_headline_visible']))
  OR (key LIKE 'operator_display_name_%')
  OR (key LIKE 'operator_cover_%')
);
UPDATE public.site_settings SET value = '1' WHERE key = 'store_layout_v2';