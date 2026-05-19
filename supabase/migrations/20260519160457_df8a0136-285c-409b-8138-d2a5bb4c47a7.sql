-- Update first order item
UPDATE public.order_items 
SET delivery_data = '{"id": "ed6ce182-b679-4d93-ac4f-5d220b4720bc", "name": "BM #9", "identification_link": "Bm Fbflix 5064\thttps://business.facebook.com/invitation/?token=AfkZWamXoqpq4-2mwUIIUALKg9NFuKfD1mTEmZTTlrf0nGQohCd2Pw7-IfNkSEqFfxZl3W_gWZZQAnKFIFLMS71GYZHNdbMCdsI2i0PX7Ng-eSxEMhbjAPd3lXPeKrwSC2HPwEFKH5IgrbbYypnyvCby_iYsIHroWaL5yGvlZvmTjALzM_bKpJf3hl4W4K3neqjCmIGfhvZchYIMzMrPiuLTlAv9rmcORZLJoEtWGKNDaUCvHZUvlQXhMPpPlVp2p3FDLe4qfUdRsjXNsIBnr4hJsK3_HBHU"}'
WHERE id = '8949e693-cf3a-40cc-a9a4-16d40750950e';

-- Update first stock item
UPDATE public.stock_items 
SET status = 'sold', order_item_id = '8949e693-cf3a-40cc-a9a4-16d40750950e'
WHERE id = 'ed6ce182-b679-4d93-ac4f-5d220b4720bc';

-- Update second order item
UPDATE public.order_items 
SET delivery_data = '{"id": "4993d3dd-e92a-4b2d-9ae2-f531bd3f3045", "name": "BM #4", "identification_link": "Bm Fbflix 4056\thttps://business.facebook.com/invitation/?token=AfkNM3Hl1F6-8DDgJWlL9PpXheZe57qgSw8as2aOVvGO-8uQObwkbsyVQt5DwXPtt9W4NM3fdI6LV7qVO7ET-pCLfIYy--fBI5izjL21M0DpIz3Kkrk100mnAbQoh4U25s01cg6lhQAs4sLk-zUHIJAa6-Df2rm9yEQZA2FZkX3nCiGZT5vMEqeckv_rWltUxOgQ3LTHU2Elki3ZLezGiprJLQ8HWgtRUluZUt1esmiIAI3kAKM_yBL0kR8YvfyDr8dqkwwGqlFREK5kYCunhxh189P_qQOY"}'
WHERE id = 'cae2438e-15b6-4623-950e-3ddca232106b';

-- Update second stock item
UPDATE public.stock_items 
SET status = 'sold', order_item_id = 'cae2438e-15b6-4623-950e-3ddca232106b'
WHERE id = '4993d3dd-e92a-4b2d-9ae2-f531bd3f3045';
