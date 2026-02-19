INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'fabricionedino@gmail.com'
ON CONFLICT DO NOTHING;