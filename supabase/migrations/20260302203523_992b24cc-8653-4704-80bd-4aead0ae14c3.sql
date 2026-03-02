
-- Sync stock counts with actual available stock_items

-- BM 3: has 1 available item but stock shows 0
UPDATE products SET stock = 1, available = true
WHERE id = '8665ad5a-8880-4e77-b03d-6e78737a932d';

-- Perfil CA 4: stock shows 34 but only 14 items available
UPDATE products SET stock = 14
WHERE id = '243621ce-e0da-49af-9713-3fd49e19ca70';
