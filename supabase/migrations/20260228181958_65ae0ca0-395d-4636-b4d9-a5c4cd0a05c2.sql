
-- 1. Update the kept profile with missing data from duplicate
UPDATE public.profiles 
SET birth_date = '1964-02-11', cep = '04604006'
WHERE user_id = '2d811ea5-ed52-4b62-ad1c-9757653817f3';

-- 2. Delete duplicate profile
DELETE FROM public.profiles WHERE user_id = 'ccee7e3d-395e-416a-9ca5-ede0dbecfe15';

-- 3. Delete duplicate user_roles
DELETE FROM public.user_roles WHERE user_id = 'ccee7e3d-395e-416a-9ca5-ede0dbecfe15';
