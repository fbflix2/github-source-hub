-- Step 1: Update the stock items statuses
UPDATE public.stock_items 
SET status = 'disponivel', 
    order_item_id = NULL,
    updated_at = now()
WHERE id = '38301d04-a23a-4623-913b-350101c7d989';

UPDATE public.stock_items 
SET status = 'vendido',
    updated_at = now()
WHERE id = '95157196-4e4c-4c3c-a7da-8909f083846e';

-- Step 2: Restore the delivery data in order_items
-- We need to restore the data from stock item 95157196
-- We also remove the _replaced flags that were added by the last replacement
UPDATE public.order_items
SET delivery_data = (
    delivery_data - '_replaced' - '_replaced_at' - '_replaced_stock_item_ids' - '_replacement_old_stock_item_id' - '_replacement_stock_item_id'
) || jsonb_build_object(
    'rawBmInput', 'BM 4920 - 350 fbflix|https://business.facebook.com/invitation/?token=AfnMSxNAOxPo9WObpyQX5Bm2w0yNXa61HoKiZh6A9DGmMiUGTLdHm2WkaNIQ3-rBasyt4IRbvd_Q2nSwQFl-gE_ZRJSYrOWFI_nHlGggvMeqR2VZCPFW1DqgK_puqLO9yYGlb2b1OxJDnglaQLLkLY4hcdXOaz-zFi_oKJdRRzxdUWaFoKBZ8Jr-dnDWZm_MtjCoBTUhnUqbNwuwmbBETnuDmDixvegM51TRvM1xGm3b1m1BA04fUNbySPqFhrN8PVdO7ME501GhlRyToGWVjXYodvPivA',
    'linkPerfil', 'https://business.facebook.com/invitation/?token=AfnMSxNAOxPo9WObpyQX5Bm2w0yNXa61HoKiZh6A9DGmMiUGTLdHm2WkaNIQ3-rBasyt4IRbvd_Q2nSwQFl-gE_ZRJSYrOWFI_nHlGggvMeqR2VZCPFW1DqgK_puqLO9yYGlb2b1OxJDnglaQLLkLY4hcdXOaz-zFi_oKJdRRzxdUWaFoKBZ8Jr-dnDWZm_MtjCoBTUhnUqbNwuwmbBETnuDmDixvegM51TRvM1xGm3b1m1BA04fUNbySPqFhrN8PVdO7ME501GhlRyToGWVjXYodvPivA',
    'bmLinks', jsonb_build_array('https://business.facebook.com/invitation/?token=AfnMSxNAOxPo9WObpyQX5Bm2w0yNXa61HoKiZh6A9DGmMiUGTLdHm2WkaNIQ3-rBasyt4IRbvd_Q2nSwQFl-gE_ZRJSYrOWFI_nHlGggvMeqR2VZCPFW1DqgK_puqLO9yYGlb2b1OxJDnglaQLLkLY4hcdXOaz-zFi_oKJdRRzxdUWaFoKBZ8Jr-dnDWZm_MtjCoBTUhnUqbNwuwmbBETnuDmDixvegM51TRvM1xGm3b1m1BA04fUNbySPqFhrN8PVdO7ME501GhlRyToGWVjXYodvPivA')
)
WHERE id = '8746b631-d866-4bce-9587-6270aef237aa';

-- Step 3: Delete the replacement record
DELETE FROM public.replacements 
WHERE id = '9fc0fa9c-f342-4533-8a23-7e6de94f08b9';