-- Add soft delete support to stock_folders
ALTER TABLE public.stock_folders ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Add soft delete support to stock_items (to preserve items from deleted folders)
ALTER TABLE public.stock_items ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;