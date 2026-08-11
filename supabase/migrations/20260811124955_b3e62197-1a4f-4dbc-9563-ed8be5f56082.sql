INSERT INTO public.site_settings (key, value) VALUES ('store_layout_rev', extract(epoch from now())::bigint::text)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;