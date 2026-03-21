-- Remove Fabricio's BM vaults
DELETE FROM public.safe_bm_vaults WHERE id IN ('47f05ac2-8d94-480a-ab41-b77b3105b5d9', '6d46e02f-3edc-486b-b447-94fd1d3bc323');

-- Remove any bm_tracking entries for this user
DELETE FROM public.bm_tracking WHERE client_user_id = '51d84540-066d-4f6d-b06b-a4c6156474c3';