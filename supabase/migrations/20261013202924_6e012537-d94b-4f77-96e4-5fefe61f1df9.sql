UPDATE public.resellers r
SET user_id = u.id
FROM auth.users u
WHERE r.id = '67b6094f-2988-497f-b666-3d4e9620cb0d'
  AND lower(u.email) = 'agenciablackrocket@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM public.resellers r2 WHERE r2.user_id = u.id AND r2.id <> r.id);

UPDATE public.profiles p
SET reseller_id = NULL
FROM auth.users u
WHERE p.user_id = u.id AND lower(u.email) = 'agenciablackrocket@gmail.com'
  AND p.reseller_id IS NOT NULL;