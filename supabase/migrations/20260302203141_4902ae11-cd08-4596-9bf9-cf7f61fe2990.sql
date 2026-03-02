
-- Fix Perfil CA 1 stock: no available items remain
UPDATE products SET stock = 0, available = false WHERE id = '79152efa-04f3-469b-955a-6e00b827dcca';
