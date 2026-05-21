UPDATE public.site_settings 
SET value = jsonb_set(
  value::jsonb, 
  '{hero,videoUrl}', 
  '"https://www.youtube.com/embed/FRyGMVofG8Q?autoplay=1&mute=1&loop=1&playlist=FRyGMVofG8Q&controls=1&showinfo=0&modestbranding=1&rel=0"'
)
WHERE key = 'landing_page_config';