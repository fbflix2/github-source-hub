-- Fix stock for Perfil CA 2 that was sold but not decremented
UPDATE products SET stock = 0, available = false WHERE id = '437e6d97-f9b6-4924-a3ff-a1e0fea1d5f4' AND stock = 1;