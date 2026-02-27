
CREATE TABLE public.page_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_item_id UUID NOT NULL,
  order_code TEXT NOT NULL,
  user_id UUID NOT NULL,
  client_name TEXT,
  product_name TEXT NOT NULL,
  profile_links TEXT[] NOT NULL DEFAULT '{}',
  all_on_one_profile BOOLEAN NOT NULL DEFAULT false,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  confirmed_at TIMESTAMP WITH TIME ZONE,
  confirmed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.page_requests ENABLE ROW LEVEL SECURITY;

-- Staff can manage all page requests
CREATE POLICY "Staff can manage page requests"
  ON public.page_requests
  FOR ALL
  USING (is_staff(auth.uid()));

-- Users can insert their own page requests
CREATE POLICY "Users can insert own page requests"
  ON public.page_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own page requests
CREATE POLICY "Users can view own page requests"
  ON public.page_requests
  FOR SELECT
  USING (auth.uid() = user_id);
