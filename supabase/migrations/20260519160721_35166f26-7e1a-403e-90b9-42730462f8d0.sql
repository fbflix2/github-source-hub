-- 1. Revert previous stock items to 'available'
UPDATE public.stock_items 
SET status = 'available', order_item_id = NULL
WHERE id IN ('ed6ce182-b679-4d93-ac4f-5d220b4720bc', '4993d3dd-e92a-4b2d-9ae2-f531bd3f3045');

-- 2. Delivery for Item 1 (BM #26)
UPDATE public.order_items 
SET delivery_data = '{"id": "6e603826-270f-496c-b9ae-bc457f047398", "name": "BM #26", "identification_link": "Bm Fbflix 9692 https://business.facebook.com/invitation/?token=AfkrVI3-eQwPfNsWLNLJWDLX46TTo3mEtV2sxEtQIKK61sF22viIs4NP_XWwfMHfIuAHjBnaC_Y-AVK8L5CKuYj6zckFXIub70lnLwQSoAEH0wTH52N9R19y3-T4F249Qhv8txyP3jnjNTddfpJcaFzsst6ukZOLiwaYGsgfmNWtBEBAUccxPRWzPN6YLtN9nzUP5o6T9UuYC0any5O5g1j6MjfB3cr5RgpoSkSn2NptudTItounf048zpXi6ZVFdnflw8lYI-xlIScffp4blqhyVSLyy19rjA"}'
WHERE id = '8949e693-cf3a-40cc-a9a4-16d40750950e';

UPDATE public.stock_items 
SET status = 'sold', order_item_id = '8949e693-cf3a-40cc-a9a4-16d40750950e'
WHERE id = '6e603826-270f-496c-b9ae-bc457f047398';

-- 3. Delivery for Item 2 (BM #23)
UPDATE public.order_items 
SET delivery_data = '{"id": "303f93fa-43dd-412c-a115-069108149692", "name": "BM #23", "identification_link": "Bm Fbflix 8819  https://business.facebook.com/invitation/?token=AflR0kK8qJmQD1zxjX2TW0JtkHH5HXa_3oeBqCgKFjYY2MVb63fggLGBvPTrUEICKUWfCiOiyEqc36mgOQdcBIxf8EsOQfWHbsBLfYrxybu4V6faTwrRJ-43OlfX-wSMd4CrSO05QxLnmzf3r7ldeNuPup_sHhabfwKVvI2qYgNn3qU4vipcC7lFYK1ZtiwOeFvcC22gnG1qD9DnGjDJSxdS_m47q8wcAynTWhR6-swpV7SmIC4KdUDWjYbAD442XFcH8MQA5gHPyI45CaFZhjMJ_G0Se7e7Gw"}'
WHERE id = 'cae2438e-15b6-4623-950e-3ddca232106b';

UPDATE public.stock_items 
SET status = 'sold', order_item_id = 'cae2438e-15b6-4623-950e-3ddca232106b'
WHERE id = '303f93fa-43dd-412c-a115-069108149692';
